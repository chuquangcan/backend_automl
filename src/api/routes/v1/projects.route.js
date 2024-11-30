import { Router } from "express";
import ProjectController from "../../controllers/project.controller.js";

const projectRouter = Router();

projectRouter.get("/", ProjectController.List);
projectRouter.get("/models", ProjectController.ListModel);
projectRouter.get("/:id", ProjectController.Get);
projectRouter.post("/", ProjectController.Create);
projectRouter.put("/:id", ProjectController.Update);
projectRouter.post("/:id/delete", ProjectController.Delete);
projectRouter.post("/:id/upload", ProjectController.UploadFiles);
projectRouter.post("/:id/train", ProjectController.TrainModel);
projectRouter.get("/:id/datasets", ProjectController.GetDatasets);
projectRouter.post("/:id/ls_dataset", ProjectController.CreateLSDataset);
projectRouter.get("/:id/ls_dataset", ProjectController.GetLSDataset);
projectRouter.get("/:id/fulldatasets", ProjectController.GetFullDatasets);
projectRouter.post("/:id/explain", ProjectController.ExplainInstance);
projectRouter.post("/:id/autolabel", ProjectController.AutoLabeling);

export default projectRouter;
