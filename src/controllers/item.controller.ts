import type { Request, Response } from "express";
import * as itemService from "../services/item.service.js";
import { AppError } from "../utils/app-error.js";
import {
  createItemSchema,
  updateItemSchema,
  addUnitsSchema,
  updateUnitSchema,
  itemFilterSchema,
} from "../validators/item.validator.js";

function normalizeBodyKeys(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }
  const normalized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(body as Record<string, unknown>)) {
    normalized[key.trim()] = val;
  }
  return normalized;
}

export async function listCategories(_req: Request, res: Response): Promise<void> {
  const data = await itemService.getItemCategories();

  res.status(200).json({
    success: true,
    message: "Daftar kategori barang berhasil diambil",
    data,
  });
}

export async function list(req: Request, res: Response): Promise<void> {
  const isAdmin = req.user?.role === "admin";
  const filter = itemFilterSchema.parse(req.query);
  const includeInactive = filter.includeInactive === "true";
  const onlyActive = !(isAdmin && includeInactive);

  const data = await itemService.getItems({
    categoryId: filter.categoryId,
    q: filter.q,
    onlyActive,
  });

  res.status(200).json({
    success: true,
    message: "Daftar barang berhasil diambil",
    data,
  });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const isAdmin = req.user?.role === "admin";
  const data = await itemService.getItemById(id, isAdmin);

  res.status(200).json({
    success: true,
    message: "Detail barang berhasil diambil",
    data,
  });
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new AppError(400, "Foto utama barang wajib diunggah");
  }

  const validated = createItemSchema.parse(normalizeBodyKeys(req.body));
  const data = await itemService.createItem(validated, req.file);

  res.status(201).json({
    success: true,
    message: "Barang berhasil ditambahkan",
    data,
  });
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const normalizedBody = (normalizeBodyKeys(req.body ?? {}) ?? {}) as Record<string, unknown>;

  if ("units" in normalizedBody) {
    throw new AppError(
      400,
      "Field 'units' tidak dapat diubah lewat endpoint ini. Gunakan POST /api/items/:id/units untuk menambah unit"
    );
  }

  const validated = updateItemSchema.parse(normalizedBody);
  const data = await itemService.updateItem(id, validated, req.file);

  res.status(200).json({
    success: true,
    message: "Data barang berhasil diperbarui",
    data,
  });
}

export async function archive(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await itemService.setItemActiveStatus(id, false);

  res.status(200).json({
    success: true,
    message: "Barang berhasil diarsipkan",
    data,
  });
}

export async function unarchive(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const data = await itemService.setItemActiveStatus(id, true);

  res.status(200).json({
    success: true,
    message: "Barang berhasil diaktifkan kembali",
    data,
  });
}

export async function addUnits(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const validated = addUnitsSchema.parse(normalizeBodyKeys(req.body));
  const data = await itemService.addUnitsToItem(id, validated);

  res.status(201).json({
    success: true,
    message: "Unit fisik berhasil ditambahkan ke barang",
    data,
  });
}

export async function updateUnit(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const validated = updateUnitSchema.parse(normalizeBodyKeys(req.body));
  const data = await itemService.updateItemUnit(id, validated);

  res.status(200).json({
    success: true,
    message: "Data unit barang berhasil diperbarui",
    data,
  });
}

