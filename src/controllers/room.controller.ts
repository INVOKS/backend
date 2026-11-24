import type { Request, Response } from "express";
import * as roomService from "../services/room.service.js";
import { AppError } from "../utils/app-error.js";
import {
  createRoomSchema,
  updateRoomSchema,
  setRoomFacilitiesSchema,
} from "../validators/room.validator.js";

export async function list(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user?.role === "admin";
  const includeInactive = req.query.includeInactive === "true";
  const onlyActive = !(isAdmin && includeInactive);

  const buildingId = req.query.buildingId
    ? Number(req.query.buildingId)
    : req.query.building_id
    ? Number(req.query.building_id)
    : undefined;

  const floor = req.query.floor ? String(req.query.floor) : undefined;

  const data = await roomService.getRooms({
    buildingId,
    floor,
    onlyActive,
  });

  res.status(200).json({
    success: true,
    message: "Daftar ruangan berhasil diambil",
    data,
  });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const isAdmin = req.user?.role === "admin";
  const data = await roomService.getRoomById(id, !isAdmin);

  res.status(200).json({
    success: true,
    message: "Detail ruangan berhasil diambil",
    data,
  });
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new AppError(400, "Foto utama ruangan wajib diunggah");
  }

  const validated = createRoomSchema.parse(req.body);
  // Upload dan DB insert dikelola sepenuhnya di service (termasuk cleanup jika gagal)
  const data = await roomService.createRoom(validated, req.file);

  res.status(201).json({
    success: true,
    message: "Ruangan berhasil ditambahkan",
    data,
  });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const validated = updateRoomSchema.parse(req.body);
  // Upload dan DB update dikelola sepenuhnya di service (termasuk cleanup jika gagal)
  const data = await roomService.updateRoom(id, validated, req.file, req.user?.id);

  res.status(200).json({
    success: true,
    message: "Data ruangan berhasil diperbarui",
    data,
  });
}

export async function archive(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await roomService.setRoomActiveStatus(id, false, req.user?.id);

  res.status(200).json({
    success: true,
    message: "Ruangan berhasil diarsipkan",
    data,
  });
}

export async function unarchive(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await roomService.setRoomActiveStatus(id, true, req.user?.id);

  res.status(200).json({
    success: true,
    message: "Ruangan berhasil diaktifkan kembali",
    data,
  });
}

export async function setFacilities(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const validated = setRoomFacilitiesSchema.parse(req.body);

  const data = await roomService.setRoomFacilities(id, validated);

  res.status(200).json({
    success: true,
    message: "Fasilitas ruangan berhasil diperbarui",
    data,
  });
}
