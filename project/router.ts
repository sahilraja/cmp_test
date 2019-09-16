import { Router } from "express";
import { create_city_code, edit_city_code, city_code_list, city_code_status, add_tag, edit_tag, tag_list, tag_status, add_theme, edit_theme, theme_list, theme_status, getProjectsList, getProjectDetail, createTask, taskList } from "./module";
import { NextFunction } from "connect";
const router = Router();

//  add city code
router.post("/city/code/add", async (req, res, next) => {
    try {
        res.status(200).send(await create_city_code(req.body, res.locals.user))
    } catch (err) {
        next(err)
    }
});

//  edit city code
router.post("/city/code/edit/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await edit_city_code(req.params.id, req.body, res.locals.user))
    } catch (err) {
        next(err)
    }
});

//  list of city code
router.get("/city/code/list", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await city_code_list())
    } catch (err) {
        next(err)
    }
});

//  edit status of city code
router.put("/city/code/status/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await city_code_status(req.params.id))
    } catch (err) {
        next(err);
    }
});

//  add tag
router.post("/tag/add", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await add_tag(req.body))
    } catch (err) {
        next(err);
    }
});

//  edit tag
router.post("/tag/edit/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await edit_tag(req.params.id, req.body))
    } catch (err) {
        next(err);
    }
});

//  list of tag
router.get("/tag/list", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await tag_list(req.query.search))
    } catch (err) {
        next(err);
    }
});

//  edit status of tag
router.put("/tag/status/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await tag_status(req.params.id))
    } catch (err) {
        next(err);
    }
});

//  add theme
router.post("/theme/add", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await add_theme(req.body))
    } catch (err) {
        next(err);
    }
});

//  edit tag
router.post("/theme/edit/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await edit_theme(req.params.id, req.body))
    } catch (err) {
        next(err);
    }
});

//  list of tag
router.get("/theme/list", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await theme_list())
    } catch (err) {
        next(err);
    }
});

//  edit status of tag
router.put("/theme/status/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await theme_status(req.params.id))
    } catch (err) {
        next(err);
    }
});

// get projects list
router.get("/list", async (req, res, next) => {
    try {
        res.status(200).send(await getProjectsList(res.locals.user.id))
    } catch (error) {
        next(error)
    }
});



// add task
router.post("/:id/task/add", async (req, res, next) => {
    try {
        res.status(200).send(await createTask(req.body, req.params.id))
    } catch (error) {
        next(error)
    }
})

// add task
router.get("/:id/task/list", async (req, res, next) => {
    try {
        res.status(200).send(await taskList(req.params.id))
    } catch (error) {
        next(error)
    }
})

//get project details
router.get("/:id", async (req, res, next) => {
    try {
        res.status(200).send(await getProjectDetail(req.params.id))
    } catch (error) {
        next(error)
    }
})

export = router;