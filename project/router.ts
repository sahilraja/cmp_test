import { Router } from "express";
import {
    createProject, editProject, projectList, city_code_status, add_tag, edit_tag, tag_status,
    add_theme, edit_theme, theme_list, theme_status, getProjectsList, getProjectDetail,
    createTask, getTagByIds, manageProjectMembers, getProjectTasks, editTask, linkTask, getProjectMembers, ganttChart, 
    projectMembers, getTaskDetail, addFundReleased, addFundsUtilized, getFinancialInfo, updateReleasedFund, updateUtilizedFund, 
    deleteReleasedFund, deleteUtilizedFund, uploadTasksExcel, projectCostInfo, citiisGrantsInfo, addReleasedInstallment, 
    addUtilizedInstallment, getInstallments, addOpenComment, getMyOpenCommentsHistory, myCommentDetail, getAllOpenCOmments,
     getCommentedUsers, editProjectMiscompliance, RemoveProjectMembers, replaceProjectMember, taskProjectDetails, 
     editTriPartiteDate, addPhaseToProject, listPhasesOfProject, addInstallments, addFunds, getFinancialInfoNew, 
     updateReleasedFundNew,updateUtilizedFundNew,deleteReleasedFundNew,deleteUtilizedFundNew,addInstallmentsNew, getStates, projectInfo
} from "./module";
import { NextFunction } from "connect";
import { OK } from "http-status-codes";
import { APIError, FormattedAPIError } from "../utils/custom-error";
const router = Router();
import * as complianceRouter from "./compliances/router";
import * as riskRouter from "../risks/router";
import * as opportunityRouter from "./opportunities/router";
import * as financialRouter from "./financial-info/router";
import { get as httpGet } from "http";
import { get as httpsGet } from "https";
import { FILES_SERVER_BASE } from "../utils/urls";
//  Add Project
router.post("/create", async (req, res, next) => {
    try {
        res.status(OK).send(await createProject(req.body, res.locals.user))
    } catch (err) {
        if (err.code == 11000) {
            err.message = `Reference code already exists`
        }
        next(new FormattedAPIError(err.message, false));
    }
});

router.get(`/get-states`, async (req, res, next) => {
    try {
        res.status(OK).send(await getStates())
    } catch (error) {
        next(new APIError(error.message))
    }
})

// get projects list
router.get("/list", async (req, res, next) => {
    try {
        res.status(OK).send(await getProjectsList(res.locals.user._id, (req as any).token, res.locals.user.role, req.query.page, req.query.limit))
    } catch (err) {
        next(new APIError(err.message));
    }
});

router.get(`/dashboard-info`, async (req, res, next) => {
    try {
        res.status(OK).send(await projectInfo())
    } catch (error) {
        next(new APIError(error.message))
    }
})

//get project details
router.get("/:id/detail", async (req, res, next) => {
    try {
        res.status(OK).send(await getProjectDetail(req.params.id, (req as any).token))
    } catch (err) {
        next(new APIError(err.message));
    }
})

router.post(`/:id/add-phases`, async (req, res, next) => {
    try {
        res.status(OK).send(await addPhaseToProject(req.params.id, req.body))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/list-phases`, async (req, res, next) => {
    try {
        res.status(OK).send(await listPhasesOfProject(req.params.id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post(`/:id/add-released-installment`, async (req, res, next) => {
    try {
        res.status(OK).send(await addReleasedInstallment(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post(`/:id/add-utilized-installment`, async (req, res, next) => {
    try {
        res.status(OK).send(await addUtilizedInstallment(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/installments`, async (req, res, next) => {
    try {
        res.status(OK).send(await getInstallments(req.params.id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/gantt-chart`, async (req, res, next) => {
    try {
        res.status(OK).send(await ganttChart(req.params.id, (req as any).token))
    } catch (error) {
        next(new APIError(error.message))
    }
})
//  Edit Project
router.post("/:id/edit", async (req: any, res: any, next: any) => {
    try {
        res.status(OK).send(await editProject(req.params.id, req.body, res.locals.user,req.token))
    } catch (err) {
        if (err.code == 11000) {
            err.message = `Reference code already exists`
        }
        next(new APIError(err.message));
    }
});

router.get("/:id/get-member-roles", async (req: any, res: any, next: any) => {
    try {
        res.status(OK).send(await projectMembers(req.params.id, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));
    }
});

// Manage Project members

router.post(`/:id/manage-members`, async (req, res, next) => {
    try {
        res.status(OK).send(await manageProjectMembers(req.params.id, req.body.members, res.locals.user._id, res.locals.user.role))
    } catch (error) {
        next(new APIError(error.message))
    }
}).get(`/:id/members`, async (req, res, next) => {
    try {
        res.status(OK).send(await getProjectMembers(req.params.id,res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
});

router.get("/:id/manage-members/:userId/remove", async (req, res, next) => {
    try {
        res.status(OK).send(await RemoveProjectMembers(req.params.id, req.params.userId, (req as any).token))
    } catch (error) {
        next(new APIError(error.message))
    };
});


router.post("/:id/manage-members/replace", async (req, res, next) => {
    try {
        res.status(OK).send(await replaceProjectMember(req.params.id, req.body, (req as any).token))
    } catch (error) {
        next(new APIError(error.message))
    };
});

router.post(`/:id/add-open-comment`, async (req, res, next) => {
    try {
        res.status(OK).send(await addOpenComment(req.params.id, res.locals.user, req.body))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/my-open-comments`, async (req, res, next) => {
    try {
        res.status(OK).send(await myCommentDetail(req.params.id, res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/my-open-comment-history`, async (req, res, next) => {
    try {
        res.status(OK).send(await getMyOpenCommentsHistory(req.params.id, res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/view-commented-users`, async (req, res, next) => {
    try {
        res.status(OK).send(await getCommentedUsers(req.params.id, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
});


router.post(`/:id/miscompliance/edit`, async (req, res, next) => {
    try {
        res.status(OK).send(await editProjectMiscompliance(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/view-all-open-comments`, async (req, res, next) => {
    try {
        res.status(OK).send(await getAllOpenCOmments(res.locals.user, req.params.id, req.query.userId))
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
        if (err.code == 11000) {
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
        if (err.code == 11000) {
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

router.get(`/:id/task-project-detail`, async (req, res, next) => {
    try {
        res.status(OK).send(await taskProjectDetails(req.params.id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/financial-info`, async (req, res, next) => {
    try {
        res.status(OK).send(await getFinancialInfo(req.params.id, res.locals.user._id, res.locals.user.role))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post(`/:id/add-released-fund`, async (req, res, next) => {
    try {
        res.status(OK).send(await addFundReleased(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post(`/:id/add-utilized-fund`, async (req, res, next) => {
    try {
        res.status(OK).send(await addFundsUtilized(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/update-released-fund`, async (req, res, next) => {
    try {
        res.status(OK).send(await updateReleasedFund(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/update-utilized-fund`, async (req, res, next) => {
    try {
        res.status(OK).send(await updateUtilizedFund(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/delete-released-fund`, async (req, res, next) => {
    try {
        res.status(OK).send(await deleteReleasedFund(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/delete-utilized-fund`, async (req, res, next) => {
    try {
        res.status(OK).send(await deleteUtilizedFund(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})
router.use(`/`, complianceRouter)
router.use(`/`, riskRouter)
router.use(`/`, opportunityRouter)
router.use('/', financialRouter)

import * as multer from "multer";
import { uploadToFileService } from "../documents/module";
import { UploadFormatSchema } from "./upload-format-model";
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        console.log("Dest");
        cb(null, (__dirname + '/uploads/'))
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + file.originalname)
    }
});
const upload = multer({ storage })

router.post(`/:id/upload-task-excel`, upload.single('upfile'), async (req, res, next) => {
    try {
        res.status(OK).send(await uploadTasksExcel(req.file.path, req.params.id, (req as any).token, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})
router.put("/:id/project-cost", async (req, res, next) => {
    try {
        res.status(OK).send(await projectCostInfo(req.params.id, req.body.projectCost, res.locals.user.role, res.locals.user._id));
    } catch (error) {
        next(new APIError(error.message));
    }
})
router.put("/:id/citiis-grants", async (req, res, next) => {
    try {
        res.status(OK).send(await citiisGrantsInfo(req.params.id, req.body.citiisGrants, res.locals.user.role, res.locals.user._id));
    } catch (error) {
        next(new APIError(error.message));
    }
})

router.post(`/:id/edit-tripartite`, async (req, res, next) => {
    try {
        res.status(OK).send(await editTriPartiteDate(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post(`/:id/add-installments`, async (req, res, next) => {
    try {
        res.status(OK).send(await addInstallments(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post(`/:id/add-funds`, async (req, res, next) => {
    try {
        res.status(OK).send(await addFunds(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/financial-info/new`, async (req, res, next) => {
    try {
        res.status(OK).send(await getFinancialInfoNew(req.params.id, res.locals.user._id, res.locals.user.role))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/update-released-fund/new`, async (req, res, next) => {
    try {
        res.status(OK).send(await updateReleasedFundNew(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/update-utilized-fund/new`, async (req, res, next) => {
    try {
        res.status(OK).send(await updateUtilizedFundNew(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/delete-released-fund/new`, async (req, res, next) => {
    try {
        res.status(OK).send(await deleteReleasedFundNew(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message));
    }
})

router.put(`/:id/delete-utilized-fund/new`, async (req, res, next) => {
    try {
        res.status(OK).send(await deleteUtilizedFundNew(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message));
    }
})

router.post(`/:id/add-installments/new`, async (req, res, next) => {
    try {
        res.status(OK).send(await addInstallmentsNew(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

export = router;