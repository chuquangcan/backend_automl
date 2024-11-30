import { Router } from "express";
import DatasetController from "#api/controllers/dataset.controller.js";

const datasetRouter = Router();

datasetRouter.post("/clf/:id", DatasetController.CreateClassificationDataset);

datasetRouter.put("/:id/labels", DatasetController.CreateLabelDataset);

export default datasetRouter;
