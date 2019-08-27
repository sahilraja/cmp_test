import { Router } from "express"
import { createDOC, submit } from "./module";
const router = Router()

router.post("/create", async(req: any, res: any, next: any) => {
    try {
        res.status(200).send(await createDOC(req.body,res.locals.user.id))
    } catch (err) {
        res.status(400).send({ error: err.message })
    }
});

router.post("/:id/versions/:versionId/submit",async(req:any,res:any,next:any)=>{
    try {
        res.status(200).send(await submit(req.params.id,req.params.versionId))
    } catch (error) {
        
    }
})

export = router;