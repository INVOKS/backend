import type { Request, Response } from "express";
import * as buildingService from "../services/building.service.js";
import type {
  CreateBuildingInput,
  UpdateBuildingInput,
} from "../validators/building.validator.js";

export async function list(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user?.role === "admin";
  const includeInactive = req.query.includeInactive === "true";
  const onlyActive = !(isAdmin && includeInactive);

  const data = await buildingService.getAllBuildings(onlyActive);

  res.status(200).json({
    success: true,
    message: "Daftar gedung berhasil diambil",
    data,
  });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await buildingService.getBuildingById(id);

  res.status(200).json({
    success: true,
    message: "Detail gedung berhasil diambil",
    data,
  });
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = await buildingService.createBuilding(req.body as CreateBuildingInput);

  res.status(201).json({
    success: true,
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

  res.status(200).json({
    success: true,
    message: "Data gedung berhasil diperbarui",
    data,
  });
}

export async function archive(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await buildingService.setBuildingActiveStatus(id, false);

  res.status(200).json({
    success: true,
    message: "Gedung berhasil diarsipkan",
    data,
  });
}

export async function unarchive(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await buildingService.setBuildingActiveStatus(id, true);

  res.status(200).json({
    success: true,
    message: "Gedung berhasil diaktifkan kembali",
    data,
  });
}

