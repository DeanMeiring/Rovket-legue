// A player's profile picture, or their initial when they haven't set one.
export default function Avatar({
  id,
  name,
  version,
  size = 40,
}: {
  id: string;
  name: string;
  version: string | null | undefined;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (version) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatar/${id}?v=${encodeURIComponent(version)}`}
        alt=""
        style={style}
        className="rounded-full object-cover shrink-0 bg-panel2"
      />
    );
  }
  return (
    <span
      style={{ ...style, fontSize: size * 0.42 }}
      className="rounded-full shrink-0 bg-panel2 border border-border text-slate-300 font-bold flex items-center justify-center uppercase"
      aria-hidden
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

// Crops an image file to a centred square and shrinks it for upload.
export async function squareImage(file: File, size = 256): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file isn't an image the browser can open."));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas
      .getContext("2d")!
      .drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
