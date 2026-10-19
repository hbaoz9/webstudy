export function getYouTubeVideoId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be" || host === "www.youtu.be") {
      id = url.pathname.slice(1);
    } else if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)
    ) {
      if (url.pathname === "/watch") {
        id = url.searchParams.get("v");
      } else if (/^\/(shorts|embed|live)\//.test(url.pathname)) {
        id = url.pathname.split("/")[2];
      }
    } else if (
      ["youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host) &&
      url.pathname.startsWith("/embed/")
    ) {
      id = url.pathname.split("/")[2];
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
