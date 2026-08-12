import { runTask, TaskResult } from "./client";

type SourceRef = { src_file_id: string } | { src_file_url: string };

const SD_SKIN_CONCERNS = [
  "wrinkle",
  "pore",
  "texture",
  "acne",
  "oiliness",
  "radiance",
  "eye_bag",
  "age_spot",
  "dark_circle_v2",
  "droopy_upper_eyelid",
  "droopy_lower_eyelid",
  "firmness",
  "moisture",
  "redness",
  "tear_trough",
  "skin_type",
];

export async function analyzeSkin(source: SourceRef): Promise<TaskResult> {
  return runTask("/s2s/v2.1/task/skin-analysis", {
    ...source,
    dst_actions: SD_SKIN_CONCERNS,
    miniserver_args: { enable_mask_overlay: false },
    format: "json",
    pf_camera_kit: false,
  });
}

export async function analyzeFitzpatrick(source: SourceRef): Promise<TaskResult> {
  return runTask("/s2s/v2.0/task/fitzpatrick-scale-analyzer", {
    ...source,
    version: "1.0",
  });
}

export async function analyzeFacialColorTones(source: SourceRef): Promise<TaskResult> {
  return runTask("/s2s/v2.0/task/skin-tone-analysis", {
    ...source,
  });
}

export async function tryOnClothes(
  personSource: SourceRef,
  garmentSource: { ref_file_id: string } | { ref_file_url: string },
  garmentCategory: "full_body" | "lower_body" | "upper_body" | "shoes" | "outer" | "auto" = "auto",
): Promise<TaskResult> {
  return runTask(
    "/s2s/v2.0/task/cloth-v4",
    {
      ...personSource,
      ...garmentSource,
      garment_category: garmentCategory,
    },
    { intervalMs: 2000, maxAttempts: 90 },
  );
}
