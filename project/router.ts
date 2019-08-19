import { Router } from "express";
import { create_city_code, edit_city_code, city_code_list, city_code_status } from "./module";
const router = Router();

//  add city code
router.get("/city/code/add", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await create_city_code(req.body))
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    }
});

//  edit city code
router.get("/city/code/edit/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await edit_city_code(req.params.id, req.body))
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    }
});

//  list of city code
router.get("/city/code/list", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await city_code_list())
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    }
});

//  edit status of city code
router.get("/city/code/status/:id", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await city_code_status(req.params.id))
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    }
});



export = router;