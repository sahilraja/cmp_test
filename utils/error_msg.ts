export const USER_ROUTER = {
    INVALID_ADMIN: "User don't have capability to perform this action.",
    CREATE_ROLE_FAIL: "Fail to create role.",
    TOKEN_MISSING: "Missing Token.",
    TOKEN_INVALID: "Invalid Token.",
    MANDATORY: "Required all mandatory fields.",
    VALID_PHONE_NO: "Please enter valid phone number",
    VALID_PASSWORD: "Password must have one special character and at least 6 characters",
    ALREADY_REGISTER: "User is already registered",
    INVALID_PARAMS_ID: "Given id not Valid.",
    USER_NOT_EXIST: "Coudln't find the User",
    INVALID_FIELDS: "Please enter valid Input",
    USER_NOT_REGISTER: "User Not User is not registered yet.",
    INVALID_LOGIN_DETAILS: "Invalid Login details",
    DEACTIVATED_BY_ADMIN: "Your account has been deactivated by admin",
    ROLE_NOT_FOUND: "Failed to get role",
    CAPABILITIES_NOT_FOUND: "Failed to get Capability",
    EMAIL_VERIFIED: "Email already verified",
    GROUP_NOT_FOUND: "Couldn't find group",
    USER_ARRAY: "Users must be an Array."
};

export const DOCUMENT_ROUTER = {
    MANDATORY: "All mandatory fields are required",
    CREATE_ROLE_FAIL: "Failed to create role",
    CHILD_NOT_FOUND: "Couldn't find child document",
    DOCID_NOT_VALID: "Document id - document_id is not valid",
    FILE_NOT_FOUND: "Document is mandatory",
    INVALID_ADMIN: "You don't have permission to perform this action",
    NO_PERMISSION: "Couldn't create a document. Unauthorized",
    LIMIT_EXCEEDED: "should be within specified limit",
    ALREADY_EXIST: "A folder with same name already exists",
    NO_FOLDER_PERMISSION: "Couldn't create a folder. Unauthorized",
    NO_DELETE_PERMISSION: "Couldn't delete a document. Unauthorized"
}

export const COMMENT_ROUTER = {
    MANDATORY: "All mandatory fields are required",
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
    ADD_MEMBER: "Memeber added successfully",
    REMOVE_MEMBER: "Member removed successfully"
}

export const GLOBAL_SCOPE = "global";

export const MISSING = "Missing Field.";

export const ROLE_EXIST = "Role Exist";

export const ROLE_NOT_EXIST = "Role not Exist"

export const INCORRECT_OTP = "OTP is incorrect. Please try again.";

export const PROJECT_ROUTER = {
    TASK_REQUIRED_FOR_LINKING: `Task ID is required to link task to a project`,
    NOT_MEMBER_OF_PROJECT: `User is not a member of this project`,
    PROJECT_NOT_EXISTS: `No such project exists`
}