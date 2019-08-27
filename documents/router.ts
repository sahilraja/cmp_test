import { Router } from "express"
import { createDOC } from "./module";
const router = Router()

router.post("/create", async(req: any, res: any, next: any) => {
    try {
        res.status(200).send(await createDOC(req.body,res.locals.user.id))
    } catch (err) {
        res.status(400).send({ error: err.message })
    }
});

export = router;