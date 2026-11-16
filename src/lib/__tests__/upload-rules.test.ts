import { describe, expect, it } from "vitest";

import {
  formatBytes,
  isAllowedImageFile,
  isAllowedProductFile,
  safeArchiveBaseName,
  sanitizeUploadFileName,
} from "../upload-rules";

describe("upload-rules", () => {
  it("allows expected game/developer digital assets and rejects executables/scripts", () => {
    expect(isAllowedProductFile("combat-system.rbxm")).toBe(true);
    expect(isAllowedProductFile("lobby-plugin.jar")).toBe(true);
    expect(isAllowedProductFile("bundle.zip")).toBe(true);
    expect(isAllowedProductFile("malware.exe")).toBe(false);
    expect(isAllowedProductFile("script.bat")).toBe(false);
    expect(isAllowedProductFile("installer.msi")).toBe(false);
    expect(isAllowedProductFile("noextension")).toBe(false);
  });

  it("validates image extensions cleanly", () => {
    expect(isAllowedImageFile("preview.png")).toBe(true);
    expect(isAllowedImageFile("thumb.WEBP")).toBe(true);
    expect(isAllowedImageFile("hero.svg")).toBe(false);
  });

  it("sanitizes directory traversal and odd characters", () => {
    expect(sanitizeUploadFileName("../../evil file?.zip")).toBe("evil_file_.zip");
    expect(safeArchiveBaseName("..hidden folder!")).toBe("hidden_folder_");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024 * 1024 * 5)).toBe("5.0 MB");
  });
});
