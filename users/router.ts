import { Router, Request, Response, Handler } from "express";
import { inviteUser, user_list, edit_user as edit_user, user_status, user_login, userInviteResend, RegisterUser, userDetails, userRoles, userCapabilities, forgotPassword, setNewPassword, createGroup, editGroup, groupList, groupStatus, groupDetail, addMember, removeMembers, userSuggestions, otpVerification, userInformation, getUserDetail } from "./module";
import { authenticate } from "../utils/utils";
import { NextFunction } from "connect";
var multer = require('multer');
import { readFileSync } from "fs";
import { join } from "path";
var upload = multer()
const router = Router();

//  Invite User
router.post('/create', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await inviteUser(req.body, res.locals.user));
    } catch (err) {
        next(err);
    };
});

// Register User
router.post("/register/:token", upload.single('profilePic'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await RegisterUser(req.body, req.params.token, req.file))
    } catch (err) {
        next(err);
    };
});


//  Resend invite link
router.get('/invite/resend/:role/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { role, id } = req.params
        res.status(200).send(await userInviteResend(id, role));
    } catch (err) {
        next(err);
    };
});

//  user list
router.get('/list', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        req.query.page = req.query.page || 1;
        req.query.limit = 50;
        res.status(200).send(await user_list(req.query, res.locals.user._id, req.query.page, req.query.limit));
    } catch (err) {
        next(err);
    };
});

router.get(`/detail/:id`, authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await getUserDetail(req.params.id));
    } catch (err) {
        next(err);
    };
});
//  Edit User
router.post('/edit/:id', authenticate, upload.single('profilePic'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await edit_user(req.params.id, req.body, res.locals.user));
    } catch (err) {
        next(err);
    };
});

//  change status user
router.put('/status/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await user_status(req.params.id, res.locals.user));
    } catch (err) {
        next(err);
    };
});

//  login user
router.post('/email/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await user_login(req.body));
    } catch (err) {
        next(err);
    };
});

// Get user Details
router.get("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await userDetails(res.locals.user._id));
    } catch (err) {
        next(err)
    };
});

// Get user roles
router.get("/me/role", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await userRoles(res.locals.user._id));
    } catch (err) {
        next(err);
    };
});

// Get user capabilities
router.get("/me/capabilities", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await userCapabilities(res.locals.user._id));
    } catch (err) {
        next(err);
    };
});

// Forgot Password
router.post("/forgot", async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await forgotPassword(req.body));
    } catch (err) {
        next(err)
    };
});

router.post("/forgot/verify", async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await otpVerification(req.body));
    }
    catch (err) {
        next(err)
    }
});

// Set New Password
router.post("/forgot/setPassword", async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await setNewPassword(req.body));
    } catch (err) {
        next(err);
    };
});

//  Add Group
router.post("/group/create", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await createGroup(req.body))
    } catch (err) {
        next(err);
    };
});

//  List Group
router.get("/group/list", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await groupList())
    } catch (err) {
        next(err);
    };
});

//  Edit Group
router.put("/group/:id/edit", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await editGroup(req.body, req.params.id))
    } catch (err) {
        next(err);
    };
});

//  edit status of group
router.put("/group/:id/status", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await groupStatus(req.params.id))
    } catch (err) {
        next(err);
    };
});

//  Add Member
router.post("/group/:id/member/add", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await addMember(req.params.id, req.body.users));
    } catch (err) {
        next(err);
    };
});

//  Remove Member
router.post("/group/:id/member/remove", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await removeMembers(req.params.id, req.body.users));
    } catch (err) {
        next(err);
    };
});

//  Get User suggestion
router.get("/suggestion", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await userSuggestions(req.query.search));
    } catch (err) {
        next(err);
    };
});

//  Group Details
router.get("/group/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await groupDetail(req.params.id));
    } catch (err) {
        next(err);
    };
});
router.get("/countryCodes", async (req, res, next) => {
    try {
        res.status(200).send(JSON.parse(readFileSync(join(__dirname, "..", "utils", "country_codes.json"), "utf8")))
    } catch (error) {
        next(error)
    }
})

router.get("/userInfo/:id", authenticate, async (req, res, next) => {
    try {
        res.status(200).send(await userInformation(req.params.id));
    } catch (error) {
        next(error)
    }
})
export = router;