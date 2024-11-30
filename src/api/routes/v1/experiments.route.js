import { Router } from "express";
import isAuth from "#api/middlewares/auth.middleware.js";
import ExperimentController from "../../controllers/experiment.controller.js";

const experimentRouter = Router();

experimentRouter.post("/", ExperimentController.Create);
experimentRouter.get("/latest", ExperimentController.LatestByProject);
experimentRouter.get("/deploy", ExperimentController.DeployModel);
experimentRouter.get("/train-history", ExperimentController.GetTrainingGraph);
experimentRouter.get(
  "/save-model",
  [isAuth],
  ExperimentController.SaveBestModel
);
experimentRouter.get("/model/:experimentName", ExperimentController.GetModel);
experimentRouter.post("/delete/:experimentName", ExperimentController.Delete);

export default experimentRouter;
