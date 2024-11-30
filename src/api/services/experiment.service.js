import axios from "axios";
import config from "#src/config/config.js";
import Experiment from "#api/models/experiment.model.js";
import MLModel from "#api/models/mlmodel.model.js";
import User from "#api/models/user.model.js";
import Project from "#api/models/project.model.js";
import { ExperimentStatuses } from "../data/constants.js";
import LabelService from "./label.service.js";
import ProjectService from "./project.service.js";
import RunService from "./run.service.js";

const Create = async ({ experiment_name, project_id }) => {
  try {
    await ProjectService.Get(project_id);
    const experiment = new Experiment({ name: experiment_name, project_id });
    await experiment.save();
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const Get = async (id) => {
  try {
    const experiment = await Experiment.findOne({ _id: id });
    if (!experiment) {
      throw new Error("Experiment does not exist");
    }
    return experiment;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const GetByName = async (name) => {
  try {
    const experiment = await Experiment.findOne({ name });
    if (!experiment) {
      throw new Error("Experiment does not exist");
    }
    return experiment;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const LatestByProject = async (projectID) => {
  try {
    const experiments = await Experiment.find({ project_id: projectID });
    if (!experiments || experiments.length == 0) {
      throw new Error("Project does not has any experiment");
    }
    return experiments[experiments.length - 1];
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const DeployModel = async (experimentName, experimentStatus) => {
  try {
    const experiment = await Experiment.findOne({ name: experimentName });
    if (!experiment) {
      throw new Error("Experiment does not exist");
    }
    const projectID = experiment.project_id;
    const project = await Project.findOne({ _id: projectID });
    const user = await User.findOne({ _id: project.author });

    if (experimentStatus == ExperimentStatuses.DONE) {
      const model = new MLModel({
        name: "model_" + experimentName,
        project_id: projectID,
        author_id: project.author,
        url: "not implemented",

        userEmail: user.email.split("@")[0],
        projectName: projectID,
        runID: experimentName,
      });
      await model.save();
    }

    //? temporary save model in experiment

    await Experiment.findOneAndUpdate(
      { name: experimentName },
      { status: experimentStatus }
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const GetModel = async (experimentName) => {
  try {
    const experiment = await Experiment.findOne({ name: experimentName });
    if (!experiment) {
      throw new Error("Experiment does not exist");
    }
    if (experiment.status != ExperimentStatuses.DONE) {
      throw new Error("Experiment is running or failed");
    }
    const model = await MLModel.findOne({ name: "model_" + experimentName });

    if (!model) {
      throw new Error("model not found: " + "model_" + experimentName);
    }
    return model;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const GetTrainingGraph = async (experimentName) => {
  try {
    // const experiment = await Experiment.findOne({ name: experimentName })
    // if (!experiment) {
    //   throw new Error('Experiment does not exist')
    // }

    // TODO: get training graph from ml service
    const model = await GetModel(experimentName);
    const userEmail = model.userEmail;
    const projectName = model.projectName;
    const runName = "ISE"; // fixed
    const task_id = experimentName; // 'lastest' to return lastest experiment or use experiment id to return specific experiment
    const request = `${config.mlServiceAddr}/model_service/train/fit_history/?userEmail=${userEmail}&projectName=${projectName}&runName=${runName}&task_id=${task_id}`;
    const req =
      "http://localhost:8670/model_service/train/fit_history/?userEmail=test-automl&projectName=4-animal&runName=ISE&task_id=lastest";
    const res = await axios.get(request, { accept: "application/json" });
    // const bestRun = await RunService.GetBestExperimentRun(experiment._id)

    // console.log(res.data)
    return res.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const SaveBestModel = async (userID, experimentName) => {
  try {
    const experiment = await Experiment.findOne({ name: experimentName });
    if (!experiment) {
      throw new Error("Experiment does not exist");
    }

    const bestRun = await RunService.GetBestExperimentRun(experiment._id);

    const model = new MLModel({
      name: "Untitled Model 1",
      url: bestRun.best_model_url,
      project_id: experiment.project_id,
      author_id: userID,
    });
    await model.save();
    return model;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const Delete = async (name) => {
  try {
    const experiment = await Experiment.findOne({ name: name });
    const project = await Project.findOne({ _id: experiment.project_id });
    const user = await User.findOne({ _id: project.author });

    var formdata = new FormData();
    formdata.append("user_name", user.email.split("@")[0]);
    formdata.append("project_id", project._id);
    formdata.append("experiment_name", name);

    try {
      await axios.post(
        `${config.mlServiceAddr}/model_service/delete_project`,
        formdata
      );
    } catch (error) {
      console.error(error);
      console.error(
        `delete experiment _${name}_ at mls failed, possibly because the mls server is down`
      );
    }
    await Experiment.findOneAndDelete({ name: name });
    await MLModel.findOneAndDelete({ name: "model_" + name });
    //TODO: delete experiment at ml service
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const DeleteByProject = async (projectID) => {
  try {
    const project = await Project.findOne({ _id: projectID });
    const user = await User.findOne({ _id: project.author });

    var formdata = new FormData();
    formdata.append("user_name", user.email.split("@")[0]);
    formdata.append("project_id", project._id);

    //TODO: delete project at ml service
    try {
      await axios.post(
        `${config.mlServiceAddr}/model_service/delete_project`,
        formdata
      );
    } catch (error) {
      console.error(error);
      console.error(
        `delete project _${projectID}_ at mls failed, possibly because the mls server is down`
      );
    }
    await Experiment.deleteMany({ project_id: projectID });
    await MLModel.deleteMany({
      project_id: projectID,
    });
    //TODO: delete experiment at ml service
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const ExperimentService = {
  Create,
  LatestByProject,
  Get,
  GetByName,
  DeployModel,
  GetModel,
  GetTrainingGraph,
  SaveBestModel,
  Delete,
  DeleteByProject,
};
export default ExperimentService;
