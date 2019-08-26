import { Router, Request, Response, Handler } from "express";
import { inviteUser, user_list, edit_user_by_admin, user_status, user_login, userInviteResend, validLink, addRolesToUser } from "./module";

const router = Router();

//  Invite user
router.post('/create', async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await inviteUser(req.body, req.locals.user));
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

// Add grants to the user
router.post('/grants/add/:id', async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await addRolesToUser(req.params.id, req.body.role, req.body.project));
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

//  Resend invite link
router.get('/invite/resend/:role/:id', async (req: Request, res: Response, next: Handler) => {
    try {
        const { role, id } = req.params
        res.status(200).send(await userInviteResend(id, role));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    };
});

//  url validation
router.get("/invite/link/validation/:token", async (req: Request, res: Response, next: Handler) => {
    try {
        res.send(200).send(await validLink(req.params.token))
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