import { uploadFile } from "./client";
import { tryOnClothes } from "./endpoints";
import { youcamConfig } from "./config";

export type PanelMemberStatus = "pending" | "processing" | "success" | "error";

export interface PanelFanoutResult {
  panelId: string;
  status: PanelMemberStatus;
  resultImageUrl: string | null;
  error: string | null;
}

export interface FanoutInput {
  panelId: string;
  bodyImageBytes: Buffer;
}

/**
 * Runs the Apparel VTO fan-out across the panel. A failed panel member never
 * aborts the run — it resolves to its own error state while the rest continue.
 */
export async function runPanelFanout(
  productImageBytes: Buffer,
  productContentType: string,
  panelMembers: FanoutInput[],
  garmentCategory: Parameters<typeof tryOnClothes>[2] = "upper_body",
  onProgress?: (result: PanelFanoutResult) => void,
  apiKey?: string,
): Promise<PanelFanoutResult[]> {
  if (panelMembers.length > youcamConfig.maxCallsPerRun) {
    throw new Error(
      `Panel size ${panelMembers.length} exceeds YOUCAM_MAX_CALLS_PER_RUN (${youcamConfig.maxCallsPerRun})`,
    );
  }

  const garment = await uploadFile(productImageBytes, "product.png", productContentType, apiKey);

  const runOne = async (member: FanoutInput): Promise<PanelFanoutResult> => {
    onProgress?.({ panelId: member.panelId, status: "processing", resultImageUrl: null, error: null });
    try {
      const person = await uploadFile(member.bodyImageBytes, `${member.panelId}.png`, "image/png", apiKey);
      const task = await tryOnClothes(
        { src_file_id: person.fileId },
        { ref_file_id: garment.fileId },
        garmentCategory,
        apiKey,
      );

      if (task.status !== "success") {
        const result: PanelFanoutResult = {
          panelId: member.panelId,
          status: "error",
          resultImageUrl: null,
          error: `VTO task ended with status "${task.status}"`,
        };
        onProgress?.(result);
        return result;
      }

      const resultImageUrl = (task.results as { url?: string } | null)?.url ?? null;
      const result: PanelFanoutResult = { panelId: member.panelId, status: "success", resultImageUrl, error: null };
      onProgress?.(result);
      return result;
    } catch (err) {
      const result: PanelFanoutResult = {
        panelId: member.panelId,
        status: "error",
        resultImageUrl: null,
        error: err instanceof Error ? err.message : String(err),
      };
      onProgress?.(result);
      return result;
    }
  };

  return Promise.all(panelMembers.map(runOne));
}
