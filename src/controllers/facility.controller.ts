import type { Request, Response } from "express";
import * as facilityService from "../services/facility.service.js";
import type {
  CreateFacilityInput,
  UpdateFacilityInput,
} from "../validators/facility.validator.js";
import { sendSuccess } from "../utils/response.js";

export async function list(_req: Request, res: Response): Promise<void> {
  const data = await facilityService.getAllFacilities();

  sendSuccess(res, {
    message: "Daftar fasilitas berhasil diambil",
    data,
  });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await facilityService.getFacilityById(id);

  sendSuccess(res, {
    message: "Detail fasilitas berhasil diambil",
    data,
  });
}

export async function create(req: Request, res: Response): Promise<void> {
  const data = await facilityService.createFacility(req.body as CreateFacilityInput);

  sendSuccess(res, {
    statusCode: 201,
    message: "Fasilitas berhasil ditambahkan",
    data,
  });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await facilityService.updateFacility(
    id,
    req.body as UpdateFacilityInput
  );

  sendSuccess(res, {
    message: "Data fasilitas berhasil diperbarui",
    data,
  });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  await facilityService.deleteFacility(id);

  sendSuccess(res, {
    message: "Fasilitas berhasil dihapus",
  });
}
