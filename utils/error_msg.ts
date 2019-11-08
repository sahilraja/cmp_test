export const USER_ROUTER = {
    INVALID_USER: "Invalid Credentials.",
    INVALID_ADMIN: "You do not have necessary permissions to perform this action",
    CREATE_ROLE_FAIL: "Fail to create role.",
    TOKEN_MISSING: "Missing token",
    TOKEN_INVALID: "Invalid token.",
    MANDATORY: "Required all mandatory fields.",
    VALID_PHONE_NO: "Please enter valid phone number",
    VALID_PASSWORD: "Password must have one special character and at least 6 characters",
    ALREADY_REGISTER: "User is already registered",
    INVALID_PARAMS_ID: "Given ID is invalid",
    USER_NOT_EXIST: "User doesn't exist, please contact the admin",
    INVALID_FIELDS: "Please enter valid input",
    USER_NOT_REGISTER: "User is not registered yet",
    INVALID_LOGIN_DETAILS: "Invalid login or password",
    DEACTIVATED_BY_ADMIN: "Your account has been deactivated",
    ROLE_NOT_FOUND: "Failed to fetch role and access details",
    CAPABILITIES_NOT_FOUND: "Failed to fetch access privileges",
    EMAIL_VERIFIED: "Email ID is already verified",
    EMAIL_WRONG : "Given email id is invalid",
    GROUP_NOT_FOUND: "Please enter a valid group name",
    USER_ARRAY: "Users must be an Array.",
    ABOUTME_LIMIT:"Aboutme shall not exceed 200 characters",
    SIMILAR_MOBILE:"Old mobile number and new mobile number is similar",
    INVALID_PASSWORD: "Given password is invalid",
    INVALID_OTP: "Given email otp is invalid",
    INVALID_COUNTRYCODE:"Given country code is invalid" 
};
export const MOBILE_MESSAGES = {
    VALID_MOBILE_OTP : "Please enter a valid mobileOtp",
    SEND_OTP : "Mobile Otp send successfully",
    VALID_OTP: "Mobile otp is verified",
    INVALID_OTP : "Mobile otp is invalid"
}

export const DOCUMENT_ROUTER = {
    MANDATORY: "All mandatory fields are required",
    CREATE_ROLE_FAIL: "Failed to create role",
    CHILD_NOT_FOUND: "Couldn't find child document",
    DOCID_NOT_VALID: "Document ID is invalid",
    FILE_NOT_FOUND: "Document upload is mandatory",
    INVALID_ADMIN: "You don't have permissions to perform this action",
    NO_PERMISSION: "Unable to create the document, unauthorized access",
    LIMIT_EXCEEDED: "Document name should not exceed more than 30 characters",
    ALREADY_EXIST: "A folder with same name already exists",
    NO_FOLDER_PERMISSION: "Couldn't create a folder. Unauthorized",
    NO_DELETE_PERMISSION: "Couldn't delete a document. Unauthorized",
    DOC_ALREADY_EXIST: "A document with same name already exists"
}

export const COMMENT_ROUTER = {
    MANDATORY: "All mandatory fields are required",
}
export const AUTHENTICATE_MSG = {
    MISSING_TOKEN: "Missing token",
    INVALID_TOKEN: "Invalid token",
    INVALID_LOGIN: "Invalid login or password",
    USER_INACTIVE: "User deactivated, please contact the admin"
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
    ADD_MEMBER: "Group member added",
    REMOVE_MEMBER: "Group member removed"
}
export const SENDER_IDS = {
    OTP : "CMPOTP"
}
export const MOBILE_TEMPLATES = {
    LOGIN : "Welcome to CMP"
}

export const GLOBAL_SCOPE = "global";

export const MISSING = "Missing Field.";

export const ROLE_EXIST = "Role Exist";

export const ROLE_NOT_EXIST = "Role not Exist"

export const INCORRECT_OTP = "OTP is incorrect. Please try again.";

export const PROJECT_ROUTER = {
    MORE_THAN_ONE_RESULT_FOUND: `More than one result found for specified role`,
    TASK_REQUIRED_FOR_LINKING: `Task ID is required to link task to a project`,
    NOT_MEMBER_OF_PROJECT: `User is not a member of this project`,
    PROJECT_NOT_EXISTS: `No such project exists`
}

export const ACTIVITY_LOG = {
    TASK_DATES_UPDATED: `TASK_DATES_UPDATED`,
    CREATE_TASK_FROM_PROJECT: `CREATE_TASK_FROM_PROJECT`,
    PROJECT_CREATED: `PROJECT_CREATED`,
    TASK_LINKED_TO_PROJECT: `TASK_LINKED_TO_PROJECT`,
    PROJECT_MEMBERS_UPDATED: `PROJECT_MEMBERS_UPDATED`,
    ADDED_FUND_RELEASE: `ADDED_FUND_RELEASE`,
    ADDED_FUND_UTILIZATION: `ADDED_FUND_UTILIZATION`,
    UPDATED_FUND_RELEASE: `UPDATED_FUND_RELEASE`,
    UPDATED_FUND_UTILIZATION:`UPDATED_FUND_UTILIZATION`
}