import ExperimentService from "../services/experiment.service.js";
import ProjectService from "../services/project.service.js";

const Create = async (req, res) => {
  return res.status(400).json({ message: "Depricated" });
  // const { experiment_name, project_id } = req.body
  // try {
  //   const experiment = await ExperimentService.Create({ experiment_name, project_id })
  //   const data = await ProjectService.TrainModel(project_id)
  //   console.log('Response when call API train model: ', data)
  //   return res.json(experiment)
  // } catch (error) {
  //   return res.status(500).json({ error: error.message })
  // }
};

const LatestByProject = async (req, res) => {
  const { project_id } = req.query;
  try {
    const experiment = await ExperimentService.LatestByProject(project_id);
    return res.json({ data: experiment });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const DeployModel = async (req, res) => {
  const { experiment_name, experiment_status } = req.query;
  try {
    const data = await ExperimentService.DeployModel(
      experiment_name,
      experiment_status
    );
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const GetTrainingGraph = async (req, res) => {
  const { experiment_name } = req.query;
  try {
    const data = await ExperimentService.GetTrainingGraph(experiment_name);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const SaveBestModel = async (req, res) => {
  const { _id } = req.user;
  const { experiment_name } = req.query;
  try {
    const data = await ExperimentService.SaveBestModel(_id, experiment_name);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const GetModel = async (req, res) => {
  const { experimentName: experiment_name } = req.params;

  try {
    const data = await ExperimentService.GetModel(experiment_name);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const Delete = async (req, res) => {
  const { experimentName: experiment_name } = req.params;
  try {
    await ExperimentService.Delete(experiment_name);
    return res.json({ message: `experiment _${experiment_name}_ deleted` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const ExperimentController = {
  Create,
  LatestByProject,
  DeployModel,
  GetTrainingGraph,
  SaveBestModel,
  GetModel,
  Delete,
};
export default ExperimentController;
