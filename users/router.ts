import { Router, Request, Response, Handler } from "express";
import { invite_user, user_list, edit_user_by_admin, user_status, user_login, user_invite_resend, validate_link } from "./module";

const router = Router();

//  invite user
router.post('/invite', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await invite_user(req.body));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    };
});

//  resend invite link
router.get('/invite/resend/:id', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await user_invite_resend(req.params.id));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    };
});

//  url validation
router.get("/invite/link/validation/:token", async (req: Request, res: Response, next: Handler) => {
    try {
        res.send(200).send(await validate_link(req.params.token))
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    }
})

//  user list
router.get('/list', async (req: Request, res: Response, next: Handler) => {
    try {
        req.query.page = req.query.page || 1;
        req.query.limit = 50;
        res.status(200).send(await user_list(req.query, req.query.page, req.query.limit));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    };
});

//  edit user
router.get('/edit/:id', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await edit_user_by_admin(req.params.id, req.body));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    };
});

//  change status user
router.get('/status/:id', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await user_status(req.params.id));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    };
});

//  login user
router.get('/login', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await user_login(req.body));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    };
});

//  register user
// router.get('/register', async (req: Request, res: Response, next: Handler) => {
//     try {
//         res.status(200).send(await user_register(req.body));
//     } catch (err) {
//         res.status(400).send({ status: false, error: err.message })
//     };
// });


export = router;