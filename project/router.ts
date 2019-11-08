import { Router } from "express";
import { createProject, editProject, projectList, city_code_status, add_tag, edit_tag, tag_status, 
    add_theme, edit_theme, theme_list, theme_status, getProjectsList, getProjectDetail, 
    createTask, getTagByIds, manageProjectMembers, getProjectTasks, editTask, linkTask, getProjectMembers, ganttChart, projectMembers, getTaskDetail, addFundReleased, addFundsUtilized, getFinancialInfo, updateReleasedFund, updateUtilizedFund, deleteReleasedFund, deleteUtilizedFund } from "./module";
import { NextFunction } from "connect";
import { OK } from "http-status-codes";
import { APIError, FormattedAPIError } from "../utils/custom-error";
const router = Router();
import * as complianceRouter from "./compliances/router";
//  Add Project
router.post("/create", async (req, res, next) => {
    try {
        res.status(OK).send(await createProject(req.body, res.locals.user))
    } catch (err) {
        if(err.code == 11000){
            err.message = `Reference code already exists`
        }
        next(new FormattedAPIError(err.message, false));
    }
});

// get projects list
router.get("/list", async (req, res, next) => {
    try {
        res.status(OK).send(await getProjectsList(res.locals.user._id, (req as any).token))
    } catch (err) {
        next(new APIError(err.message));
    }
});

//get project details
router.get("/:id/detail", async (req, res, next) => {
    try {
        res.status(OK).send(await getProjectDetail(req.params.id))
    } catch (err) {
        next(new APIError(err.message));
    }
})

router.get(`/:id/gantt-chart`, async (req,res, next) => {
    try {
        res.status(OK).send(await ganttChart(req.params.id, (req as any).token))
    } catch (error) {
        next(new APIError(error.message))
    }
})
//  Edit Project
router.post("/:id/edit", async (req: any, res: any, next: any) => {
    try {
        res.status(OK).send(await editProject(req.params.id, req.body, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));
    }
});

router.get("/:id/get-member-roles", async (req: any, res: any, next: any) => {
    try {
        res.status(OK).send(await projectMembers(req.params.id))
    } catch (err) {
        next(new APIError(err.message));
    }
});

// Manage Project members

router.post(`/:id/manage-members`, async (req, res, next) => {
    try {
        res.status(OK).send(await manageProjectMembers(req.params.id, req.body.members, res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
}).get(`/:id/members`, async (req, res, next) => {
    try {
        res.status(OK).send(await getProjectMembers(req.params.id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

//  edit status of Project
router.put("/city/code/status/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(OK).send(await city_code_status(req.params.id, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));;
    }
});

//  add tag
router.post("/tag/add", async (req: any, res: any, next: any) => {
    try {
        res.status(OK).send(await add_tag(req.body, res.locals.user))
    } catch (err) {
        if(err.code == 11000){
            err.message = `Tag already exists`
        }
        next(new APIError(err.message));;
    }
});

//  edit tag
router.post("/tag/edit/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(OK).send(await edit_tag(req.params.id, req.body, res.locals.user))
    } catch (err) {
        if(err.code == 11000){
            err.message = `Tag already exists`
        }
        next(new APIError(err.message));;
    }
});



router.post(`/getTagByIds`, async (req, res, next) => {
    try {
        res.status(OK).send(await getTagByIds(req.body.ids))
    } catch (err) {
        next(new APIError(err.message));
    }
})

//  edit status of tag
router.put("/tag/status/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(OK).send(await tag_status(req.params.id, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));;
    }
});

//  add theme
router.post("/theme/add", async (req: any, res: any, next: any) => {
    try {
        res.status(OK).send(await add_theme(req.body))
    } catch (err) {
        next(new APIError(err.message));;
    }
});

//  edit tag
router.post("/theme/edit/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(OK).send(await edit_theme(req.params.id, req.body))
    } catch (err) {
        next(new APIError(err.message));;
    }
});

//  list of tag
router.get("/theme/list", async (req: any, res: any, next: any) => {
    try {
        res.status(OK).send(await theme_list())
    } catch (err) {
        next(new APIError(err.message));;
    }
});

//  edit status of tag
router.put("/theme/status/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(OK).send(await theme_status(req.params.id))
    } catch (err) {
        next(new APIError(err.message));;
    }
});

// add task
router.post("/:id/create-task", async (req, res, next) => {
    try {
        res.status(OK).send(await createTask(req.body, req.params.id, (req as any).token, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));
    }
})

// add task
router.get("/:id/task-list", async (req, res, next) => {
    try {
        res.status(OK).send(await getProjectTasks(req.params.id, (req as any).token))
    } catch (err) {
        next(new APIError(err.message));
    }
})

router.get(`/:id/task/:task_id/view`, async (req, res, next) => {
    try {
        res.status(OK).send(await getTaskDetail(req.params.id, req.params.task_id, res.locals.user._id, (req as any).token))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post(`/:id/task/:task_id/edit-date`, async (req, res, next) => {
    try {
        res.status(OK).send(await editTask(req.params.id, req.params.task_id, res.locals.user, (req as any).token, req.body))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post(`/:id/link-task`, async (req, res, next) => {
    try {
        res.status(OK).send(await linkTask(req.params.id, req.body.taskId, (req as any).token, res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/finalcial-info`, async (req, res, next) =>  {
    try {
        res.status(OK).send(await getFinancialInfo(req.params.id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post(`/:id/add-released-fund`, async (req, res, next) => {
    try {
        res.status(OK).send(await addFundReleased(req.params.id, req.body, res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post(`/:id/add-utilized-fund`, async (req, res, next) => {
    try {
        res.status(OK).send(await addFundsUtilized(req.params.id, req.body, res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/update-released-fund`, async (req, res, next) => {
    try {
        res.status(OK).send(await updateReleasedFund(req.params.id, req.body, res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/update-utilized-fund`, async (req, res, next) => {
    try {
        res.status(OK).send(await updateUtilizedFund(req.params.id, req.body, res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/delete-released-fund`, async (req, res, next) => {
    try {
        res.status(OK).send(await deleteReleasedFund(req.params.id, req.body, res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/delete-utilized-fund`, async (req, res, next) => {
    try {
        res.status(OK).send(await deleteUtilizedFund(req.params.id, req.body, res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

export = router;