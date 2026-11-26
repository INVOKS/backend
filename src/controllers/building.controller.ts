import type { Request, Response } from "express";
import * as buildingService from "../services/building.service.js";
import type {
  CreateBuildingInput,
  UpdateBuildingInput,
} from "../validators/building.validator.js";
import { sendSuccess } from "../utils/response.js";

export async function list(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user?.role === "admin";
  const includeInactive = req.query.includeInactive === "true";
  const onlyActive = !(isAdmin && includeInactive);

  const data = await buildingService.getAllBuildings(onlyActive);

  sendSuccess(res, {
    message: "Daftar gedung berhasil diambil",
    data,
  });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await buildingService.getBuildingById(id);

  sendSuccess(res, {
    message: "Detail gedung berhasil diambil",
    data,
  });
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = await buildingService.createBuilding(req.body as CreateBuildingInput);

  sendSuccess(res, {
    statusCode: 201,
    message: "Gedung berhasil ditambahkan",
    data,
  });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await buildingService.updateBuilding(
    id,
    req.body as UpdateBuildingInput
  );

  sendSuccess(res, {
    message: "Data gedung berhasil diperbarui",
    data,
  });
}

export async function archive(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await buildingService.setBuildingActiveStatus(id, false);

  sendSuccess(res, {
    message: "Gedung berhasil diarsipkan",
    data,
  });
}

export async function unarchive(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await buildingService.setBuildingActiveStatus(id, true);

  sendSuccess(res, {
    message: "Gedung berhasil diaktifkan kembali",
    data,
  });
}
