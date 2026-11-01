// Phone screenshots are huge; shrink them so several fit under the API's request size limit.
const MAX_SIDE = 1400;

export async function toDataUrl(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}
