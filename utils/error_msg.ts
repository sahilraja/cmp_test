export const USER_ROUTER = {
    INVALID_ADMIN: "User don't have capability to perform this action.",
    CREATE_ROLE_FAIL: "Fail to create role.",
    TOKEN_MISSING: "Missing Token.",
    TOKEN_INVALID: "Invalid Token.",
    MANDATORY: "Required all mandatory fields.",
    VALID_PHONE_NO: "Enter Valid Phone Number.",
    VALID_PASSWORD: "Password must have one special character and at least 6 characters",
    ALREADY_REGISTER: "Already User Registered.",
    INVALID_PARAMS_ID: "Given id not Valid.",
    USER_NOT_EXIST: "User Not found.",
    INVALID_FIELDS: "Enter Valid input.",
    USER_NOT_REGISTER: "User Not Registered.",
    INVALID_LOGIN_DETAILS: "Invalid login details.",
    DEACTIVATED_BY_ADMIN: "Account Deactivated By Admin.",
    ROLE_NOT_FOUND: "Fail to get Role.",
    CAPABILITIES_NOT_FOUND: "Fail to get Capabilities.",
    EMAIL_VERIFIED: "Email Already Verified",
    GROUP_NOT_FOUND: "Group not found.",
    USER_ARRAY: "Users must be an Array."
};

export const DOCUMENT_ROUTER = {
    MANDATORY: "Required all mandatory fields.",
    CREATE_ROLE_FAIL: "Fail to create role.",
    CHILD_NOT_FOUND: "Child Document Not Found",
    DOCID_NOT_VALID: "Given document_id is not Valid.",
    FILE_NOT_FOUND: "Document is mandatory.",
    INVALID_ADMIN: "User don't have capability to perform this action.",
    NO_PERMISSION: "Unauthorised to create document ",
    LIMIT_EXCEEDED: "should be in specified limit"
}

export const AUTHENTICATE_MSG = {
    MISSING_TOKEN: "Missing token",
    INVALID_TOKEN: "Invalid Token",
    INVALID_LOGIN: "Invalid credentials. Please login again",
    USER_INACTIVE: "Credentials not valid anymore. Please contact your technology specialist to activate your account."
}

export const MAIL_SUBJECT = {
    INVITE_USER: "Invitation from CITIIS Management Platform",
    FORGOT_PASSWORD: "CMP Reset password instructions",
    LOGIN_SUBJECT: "Login into CMP",
    OTP_SUBJECT: "CMP One Time Password"
};

export const RESPONSE = {
    SUCCESS_EMAIL: "Email send successfully.",
    ACTIVE: "active",
    INACTIVE: "inactive",
    ADD_MEMBER: "Successfully Added Member.",
    REMOVE_MEMBER: "Successfully Removed Member."
}

export const GLOBAL_SCOPE = "global";

export const MISSING = "Missing Field.";

export const ROLE_EXIST = "Role Exist";

export const ROLE_NOT_EXIST = "Role not Exist"

export const INCORRECT_OTP = "OTP is incorrect. Please try again.";