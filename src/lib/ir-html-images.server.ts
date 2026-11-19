// 서버에서 검증한 이미지 데이터만 브라우저에 전달합니다.
import { createHash } from "node:crypto";

export type ImageSlot = {
  id: string;
  slideId: string;
  origin: "generated" | "user";
  assetId: string | null;
  fit: "cover" | "contain";
  placement: null | { x: number; y: number; width: number; height: number; zIndex: number };
};
type Asset = {
  assetId: string;
  objectPath: string;
  mimeType: string;
  bytes: number;
  sha256: string;
};
export type ImageSnapshot = {
  imageSlots: ImageSlot[];
  assets: Asset[];
  document: { slides: { slideId: string }[] };
};
export type ImageComposition = {
  slides: string[];
  slots: ImageSlot[];
  data: Record<string, string>;
};

function checkImageDimensions(bytes: Uint8Array, png: boolean) {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0,
    height = 0;
  if (png && b.length >= 24 && b.subarray(12, 16).toString() === "IHDR") {
    width = b.readUInt32BE(16);
    height = b.readUInt32BE(20);
  } else if (!png) {
    let offset = 2;
    while (offset + 4 < b.length) {
      if (b[offset++] !== 255) break;
      while (b[offset] === 255) offset++;
      const marker = b[offset++];
      if (marker === 0xd9 || marker === 0xda || marker === undefined) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      const length = b.readUInt16BE(offset);
      if (length < 2 || offset + length > b.length) break;
      if (
        [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
          marker,
        ) &&
        length >= 7
      ) {
        height = b.readUInt16BE(offset + 3);
        width = b.readUInt16BE(offset + 5);
        break;
      }
      offset += length;
    }
  }
  if (!width || !height || width > 12000 || height > 12000 || width * height > 40000000) {
    throw new Error("EXPORT_IMAGE_INVALID");
  }
  return width * height;
}

export async function prepareImageComposition(
  snapshot: ImageSnapshot,
  loadAsset: (asset: Readonly<Asset>) => Promise<Uint8Array>,
): Promise<ImageComposition> {
  const slides = snapshot.document.slides.map((s) => s.slideId);
  if (snapshot.imageSlots.length > 256 || snapshot.assets.length > 64)
    throw new Error("EXPORT_TOO_LARGE");
  if (slides.length !== 7 || new Set(slides).size !== 7)
    throw new Error("EXPORT_VALIDATION_FAILED");
  const ids = new Set<string>();
  const referenced = new Set<string>();
  for (const slot of snapshot.imageSlots) {
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(slot.id) ||
      ids.has(slot.id) ||
      !slides.includes(slot.slideId) ||
      !["contain", "cover"].includes(slot.fit)
    ) {
      throw new Error("EXPORT_IMAGE_INVALID");
    }
    ids.add(slot.id);
    if (slot.origin === "user") {
      const p = slot.placement;
      if (
        !p ||
        !Object.values(p).every(Number.isFinite) ||
        p.x < 0 ||
        p.y < 0 ||
        p.width < 1 ||
        p.height < 1 ||
        p.x + p.width > 1920 ||
        p.y + p.height > 1080 ||
        !Number.isInteger(p.zIndex) ||
        p.zIndex < 0 ||
        p.zIndex > 10000 ||
        !slot.assetId
      ) {
        throw new Error("EXPORT_IMAGE_INVALID");
      }
    } else if (slot.origin !== "generated" || slot.placement !== null) {
      throw new Error("EXPORT_IMAGE_INVALID");
    }
    if (slot.assetId) referenced.add(slot.assetId);
  }
  const assets = new Map(snapshot.assets.map((a) => [a.assetId, a]));
  if (assets.size !== snapshot.assets.length || assets.size !== referenced.size) {
    throw new Error("EXPORT_IMAGE_INVALID");
  }
  const data: Record<string, string> = Object.create(null) as Record<string, string>;
  let total = 0;
  let totalPixels = 0;
  // 직렬 다운로드로 메모리 급증을 제한합니다. 동일 이미지는 한 번만 받습니다.
  for (const id of referenced) {
    const a = assets.get(id);
    if (
      !a ||
      !["image/png", "image/jpeg"].includes(a.mimeType) ||
      !Number.isInteger(a.bytes) ||
      a.bytes < 1 ||
      a.bytes > 3145728 ||
      !/^[a-f0-9]{64}$/.test(a.sha256) ||
      !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/source\.(png|jpg)$/.test(a.objectPath) ||
      a.objectPath.split("/")[2] !== id
    )
      throw new Error("EXPORT_IMAGE_INVALID");
    total += a.bytes;
    if (total > 25165824) throw new Error("EXPORT_TOO_LARGE");
    const bytes = await loadAsset(Object.freeze({ ...a }));
    if (
      bytes.byteLength !== a.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== a.sha256
    ) {
      throw new Error("EXPORT_IMAGE_INVALID");
    }
    const png =
      bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
    const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if ((a.mimeType === "image/png" && !png) || (a.mimeType === "image/jpeg" && !jpeg)) {
      throw new Error("EXPORT_IMAGE_INVALID");
    }
    totalPixels += checkImageDimensions(bytes, png);
    if (totalPixels > 80000000) throw new Error("EXPORT_TOO_LARGE");
    data[id] = `data:${a.mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
  }
  return { slides, slots: snapshot.imageSlots, data };
}

// page.evaluate(composeImagesInPage, plan)으로 호출. 외부 함수/스크립트에 의존하지 않습니다.
export async function composeImagesInPage(plan: ImageComposition) {
  const roots = Array.from(document.querySelectorAll<HTMLElement>("section[data-slide-id]"));
  if (roots.length !== 7 || roots.some((r, i) => r.dataset["slideId"] !== plan.slides[i])) {
    throw new Error("EXPORT_VALIDATION_FAILED");
  }
  const loads: Promise<void>[] = [];
  for (const root of roots) {
    const slots = plan.slots.filter((s) => s.slideId === root.dataset["slideId"]);
    const placeholders = Array.from(root.querySelectorAll<HTMLElement>("[data-image-slot-id]"));
    if (placeholders.length !== slots.filter((s) => s.origin === "generated").length) {
      throw new Error("EXPORT_IMAGE_INVALID");
    }
    for (const slot of slots) {
      let host: HTMLElement;
      if (slot.origin === "generated") {
        const matches = placeholders.filter((n) => n.dataset["imageSlotId"] === slot.id);
        if (matches.length !== 1) throw new Error("EXPORT_IMAGE_INVALID");
        host = matches[0]!;
        host.querySelectorAll("[data-slot-placeholder-ui]").forEach((n) => n.remove());
        host.style.setProperty("background", "transparent", "important");
        host.style.setProperty("border", "0", "important");
        if (getComputedStyle(host).position === "static") host.style.position = "relative";
      } else {
        host = document.createElement("div");
        const p = slot.placement!;
        Object.assign(host.style, {
          position: "absolute",
          left: `${p.x}px`,
          top: `${p.y}px`,
          width: `${p.width}px`,
          height: `${p.height}px`,
          zIndex: String(p.zIndex),
          overflow: "hidden",
        });
        host.dataset["userImageId"] = slot.id;
        root.append(host);
      }
      if (!slot.assetId) continue;
      const src = plan.data[slot.assetId];
      if (!src || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(src)) {
        throw new Error("EXPORT_IMAGE_INVALID");
      }
      const img = document.createElement("img");
      img.alt = "";
      Object.assign(img.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        objectFit: slot.fit,
        display: "block",
        margin: "0",
        maxWidth: "none",
        maxHeight: "none",
      });
      img.src = src;
      host.append(img);
      loads.push(
        img.decode().then(() => {
          if (!img.naturalWidth || !img.naturalHeight) throw new Error("EXPORT_IMAGE_INVALID");
        }),
      );
    }
  }
  await Promise.all(loads);
  return { composed: true, imageCount: loads.length, slideCount: roots.length };
}
