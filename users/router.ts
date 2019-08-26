import { Router, Request, Response, Handler } from "express";
import { inviteUser, user_list, edit_user as edit_user, user_status, user_login, userInviteResend, addRolesToUser, RegisterUser, userDetails, userRoles, userCapabilities, forgotPassword, setNewPassword } from "./module";
import { authenticate } from "../utils/utils";
var multer = require('multer')
var upload = multer()

const router = Router();

//  Invite user
router.post('/create', authenticate, async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await inviteUser(req.body, res.locals.user));
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

// Add grants to the user
router.post('/grants/add/:id', authenticate, async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await addRolesToUser(req.params.id, req.body.role, req.body.project));
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

// Register User
router.post("/register/:token", upload.single('uploadPhoto'), async (req: Request, res: Response, next: Handler) => {
    try {
        res.send(200).send(await RegisterUser(req.body, req.params.token, req.file))
    } catch (err) {
        res.status(400).send({ error: err.message })
    }
});


//  Resend invite link
router.get('/invite/resend/:role/:id', authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        const { role, id } = req.params
        res.status(200).send(await userInviteResend(id, role));
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

//  user list
router.get('/list', authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        req.query.page = req.query.page || 1;
        req.query.limit = 50;
        res.status(200).send(await user_list(req.query, req.query.page, req.query.limit));
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

//  Edit User
router.get('/edit/:id', authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await edit_user(req.params.id, req.body));
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

//  change status user
router.get('/status/:id', authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await user_status(req.params.id));
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

//  login user
router.post('/email/login', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await user_login(req.body));
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

// Get user Details
router.get("/me", authenticate, async (req: any, res: Response, next: Handler) => {
    try {
        res.status(200).send(await userDetails(res.locals.user.id));
    } catch (err) {
        res.status(400).send({ err: err.message });
    };
});

// Get user roles
router.get("/me/role", authenticate, async (req: any, res: Response, next: Handler) => {
    try {
        res.status(200).send(await userRoles(res.locals.user.id));
    } catch (err) {
        res.status(400).send({ err: err.message });
    };
});

// Get user roles
router.get("/me/capabilities", authenticate, async (req: any, res: Response, next: Handler) => {
    try {
        res.status(200).send(await userCapabilities(res.locals.user.id));
    } catch (err) {
        res.status(400).send({ err: err.message });
    };
});

// Forgot Password
router.post("/forgot", async (req: any, res: Response, next: Handler) => {
    try {
        res.status(200).send(await forgotPassword(req.body));
    } catch (err) {
        res.status(400).send({ err: err.message });
    };
});

// Set New Password
router.post("/forgot/password/:token", async (req: any, res: Response, next: Handler) => {
    try {
        res.status(200).send(await setNewPassword(req.body, req.params.token));
    } catch (err) {
        res.status(400).send({ err: err.message });
    };
});



export = router;