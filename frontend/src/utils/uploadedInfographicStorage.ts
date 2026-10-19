export type InfographicTarget = "chapter" | "lesson";
export type InfographicVisibility = "draft" | "published";

export type UploadedInfographic = {
  id: string;
  targetType: InfographicTarget;
  targetId: string;
  title: string;
  imageBlob: Blob;
  mimeType: string;
  visibility: InfographicVisibility;
  createdAt: string;
};

const DB_NAME = "webstudy-uploaded-infographics-v1";
const STORE_NAME = "images";
const INDEX_NAME = "byTarget";
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

const CHANGE_CHANNEL = "webstudy-infographic-changes-v1";
const listeners = new Set<(id?: string) => void>();
const pendingReads = new Map<string, Promise<UploadedInfographic | undefined>>();
let changeChannel: BroadcastChannel | undefined;

// Messages invalidate reads; visibility is always checked against IndexedDB.
function emitChange(id?: string) {
  if (id) pendingReads.delete(id);
  else pendingReads.clear();
  listeners.forEach(listener => listener(id));
}

function refreshVisible() {
  if (document.visibilityState === "visible") emitChange();
}

function announceChange(id: string) {
  emitChange(id);
  // Publication must still succeed when cross-tab messaging is unavailable.
  try {
    const channel = changeChannel ?? new BroadcastChannel(CHANGE_CHANNEL);
    channel.postMessage({ id });
    if (channel !== changeChannel) channel.close();
  } catch { /* Focus/visibility refresh remains available. */ }
}

export function subscribeUploadedInfographicChanges(listener: (id?: string) => void): () => void {
  if (listeners.size === 0) {
    try {
      changeChannel = new BroadcastChannel(CHANGE_CHANNEL);
      changeChannel.onmessage = (event: MessageEvent<unknown>) => {
        const data = event.data;
        if (data && typeof data === "object" && "id" in data && typeof data.id === "string") emitChange(data.id);
      };
    } catch { changeChannel = undefined; }
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      changeChannel?.close();
      changeChannel = undefined;
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    }
  };
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Trình duyệt không hỗ trợ lưu ảnh."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
      store.createIndex(INDEX_NAME, ["targetType", "targetId"]);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function listUploadedInfographics(
  targetType: InfographicTarget,
  targetId: string,
): Promise<UploadedInfographic[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction
        .objectStore(STORE_NAME)
        .index(INDEX_NAME)
        .getAll([targetType, targetId]);

      transaction.oncomplete = () => {
        db.close();
        resolve(
          (request.result as UploadedInfographic[]).sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          ),
        );
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error ?? new Error("Chưa đọc được thư viện infographic."));
      };
    } catch (cause) {
      db.close();
      reject(cause);
    }
  });
}

// Resolve only the referenced record, without loading an entire chapter library.
export async function getUploadedInfographic(id: string): Promise<UploadedInfographic | undefined> {
  const pending = pendingReads.get(id);
  if (pending) return pending;
  const read = readUploadedInfographic(id);
  pendingReads.set(id, read);
  const clear = () => { if (pendingReads.get(id) === read) pendingReads.delete(id); };
  void read.then(clear, clear);
  return read;
}

async function readUploadedInfographic(id: string): Promise<UploadedInfographic | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(id);
      transaction.oncomplete = () => {
        db.close();
        resolve(request.result as UploadedInfographic | undefined);
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error ?? new Error("Chưa đọc được infographic."));
      };
    } catch (cause) {
      db.close();
      reject(cause);
    }
  });
}

export async function addUploadedInfographic(
  targetType: InfographicTarget,
  targetId: string,
  file: File,
  title: string,
): Promise<UploadedInfographic> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Chọn ảnh PNG, JPG hoặc WebP.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Ảnh tối đa 15 MB.");
  }
  if (!title.trim()) {
    throw new Error("Nhập tên infographic.");
  }

  const record: UploadedInfographic = {
    id: crypto.randomUUID(),
    targetType,
    targetId,
    title: title.trim(),
    imageBlob: file,
    mimeType: file.type,
    visibility: "draft",
    createdAt: new Date().toISOString(),
  };

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).add(record);
    transaction.oncomplete = () => {
      db.close();
      announceChange(record.id);
      resolve(record);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function deleteUploadedInfographic(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      db.close();
      announceChange(id);
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

// Read and update in one transaction, preserving the current Blob, ID and links.
// Never recreate a record that was deleted after the gallery was loaded.
export async function setUploadedInfographicVisibility(
  id: string,
  visibility: InfographicVisibility,
): Promise<UploadedInfographic> {
  if (visibility !== "draft" && visibility !== "published") {
    throw new Error("Trạng thái infographic không hợp lệ.");
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      let saved: UploadedInfographic | undefined;
      let failure: Error | undefined;
      transaction.oncomplete = () => {
        db.close();
        if (saved) { announceChange(id); resolve(saved); }
        else reject(new Error("Chưa cập nhật được trạng thái infographic."));
      };
      transaction.onabort = () => {
        db.close();
        reject(failure ?? transaction.error ?? new Error("Chưa cập nhật được trạng thái infographic."));
      };
      const request = store.get(id);
      request.onsuccess = () => {
        const current = request.result as UploadedInfographic | undefined;
        if (!current) {
          failure = new Error("Ảnh không còn trong thư viện. Hãy đóng hộp thoại và tải lại trang.");
          transaction.abort();
          return;
        }
        try {
          saved = { ...current, visibility };
          store.put(saved);
        } catch (cause) {
          failure = cause instanceof Error ? cause : new Error("Chưa cập nhật được trạng thái infographic.");
          transaction.abort();
        }
      };
    } catch (cause) {
      db.close();
      reject(cause);
    }
  });
}
