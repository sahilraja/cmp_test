import { Router } from "express"
const router = Router()

router.post("/create", (req: any, res: any, next: any) => {
    try {
        res.status(200).send({})
    } catch (err) {
        res.status(400).send({ error: err.message })
    }
});

export = router;