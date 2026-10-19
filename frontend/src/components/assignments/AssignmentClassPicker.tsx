import { useState } from "react";
import type { Classroom } from "../../types/teacher";

export function AssignmentClassPicker({
  classrooms,
  value,
  onChange,
}: {
  classrooms: Classroom[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const matches = classrooms.filter((item) =>
    item.name
      .toLocaleLowerCase("vi")
      .includes(search.trim().toLocaleLowerCase("vi")),
  );
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-bold">Chọn lớp nhận bài *</legend>
      <label className="block text-sm">
        Tìm lớp
        <input
          aria-label="Tìm lớp nhận bài"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tên lớp"
          className="mt-2 min-h-11 w-full rounded-xl border border-line px-3"
        />
      </label>
      <div className="max-h-48 space-y-1 overflow-y-auto">
        {matches.map((item) => (
          <label
            key={item.id}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={value.includes(item.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, item.id]
                    : value.filter((id) => id !== item.id),
                )
              }
              className="size-4 shrink-0 accent-emerald"
            />
            <span className="min-w-0">{item.name}</span>
          </label>
        ))}
      </div>
      {!matches.length && (
        <p className="text-sm text-secondary">Không có lớp phù hợp.</p>
      )}
      <p className="text-sm text-secondary">
        Đã chọn {value.length} lớp. Mỗi lớp nhận một bản bài tập riêng.
      </p>
    </fieldset>
  );
}
