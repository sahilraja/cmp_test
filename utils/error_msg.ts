export const USER_ROUTER = {
    INVALID_USER: "Please enter valid Login Credentils",
    INVALID_ADMIN: "You don't have permissions to perform this action",
    CREATE_ROLE_FAIL: "Role couldn't be created, please try again",
    REVOKE_ROLE_FAIL: "Failed to remove role, Please retry",
    TOKEN_MISSING: "Token found missing, please try again",
    TOKEN_INVALID: "Something went wrong. Please retry",
    MANDATORY: "Please fill all mandatory fileds",
    VALID_PHONE_NO: "Please enter valid phone number",
    VALID_PASSWORD: "Password must have one special character and at least 6 characters",
    ALREADY_REGISTER: "You are already registered, please use login functionality",
    INVALID_PARAMS_ID: "Invalid user ID. Please try again",
    USER_NOT_EXIST: "User doesn't exist, please contact the admin",
    INVALID_FIELDS: "Please enter valid Email/Password",
    USER_NOT_REGISTER: "User is not registered",
    INVALID_LOGIN_DETAILS: "Invalid login or password",
    DEACTIVATED_BY_ADMIN: "Your account has been deactivated, please contact the admin to reactivate",
    ROLE_NOT_FOUND: "Failed to fetch user details",
    CAPABILITIES_NOT_FOUND: "Failed to fetch access privileges",
    EMAIL_VERIFIED: "Email ID is already verified",
    EMAIL_WRONG: "Invalid Email ID, please enter a valid email ID",
    GROUP_NOT_FOUND: "Please enter a valid Group Name",
    USER_ARRAY: "Users must be an Array.",
    ABOUTME_LIMIT: "Please limit the response to {} characters",
    SIMILAR_MOBILE: "This mobile number exists. Please add a new mobile number for the updates",
    INVALID_PASSWORD: "Please enter valid Password",
    INVALID_OTP: "Invalid OTP! Please enter valid OTP sent to your email address",
    INVALID_COUNTRYCODE: "Given country code is invalid",
    CREATE_ROLE_NOTIFICATION_FAIL: "Failed to create notification",
    ADD_NOTIFICATION_FAIL: "Failed to add template to notification",
    BOTH_INVALID: "Invalid OTP ! Please enter valid OTP",
    TOKEN_EXPIRED: "Verification link has expired. Please request admin to send the link again",
    TOKEN_EXPIRED_OTP: "OTP verification link is expired",
    USER_EXIST: "User already registered.",
    CONSTANT_INVALID: "Constant type is invalid, please try again",
    RECAPTCHA_INVALID: "Captcha Verification failed, Please try again"
};
export const GROUP_ROUTER = {
    REMOVE_MEMBER: "Please add at least one Group Member",
    GROUP_NAME: "Group name cannot be modified"
}
export const MOBILE_MESSAGES = {
    VALID_MOBILE_OTP: "Please enter a valid mobileOtp",
    SEND_OTP: "Mobile Otp send successfully",
    VALID_OTP: "Mobile otp is verified",
    INVALID_OTP: "Invalid OTP! Please enter valid OTP sent to your mobile number",
}

export const DOCUMENT_ROUTER = {
    FILE_SIZE: (size: number) => `File size shouldn't exceed ${size} MB.`,
    DOCUMENT_NAME_LENGTH: (nameLength: number) => `Document name should not exceed more than ${nameLength} characters.`,
    DOCUMENT_DESCRIPTION_LENGTH: (descriptionLenth: number) => `Document description should not exceed more than ${descriptionLenth} characters.`,
    DOCUMENT_NAME_UNIQUE: (name: string) => `A document with name "${name}" already exists. Document name should be unique.`,
    MANDATORY: "Please fill all mandatory fields.",
    CREATE_ROLE_FAIL: "Something went wrong. Please try again.",
    CHILD_NOT_FOUND: "Something went wrong. Please try again.",
    DOCID_NOT_VALID: "Document ID is invalid.",
    FILE_NOT_FOUND: "Document upload is mandatory.",
    INVALID_ADMIN: "You don't have permissions to perform this action.",
    INVALID_UPDATE_USER: "You don't have permissions to update this document.",
    NO_PERMISSION: "You don't have permission to create a Document",
    NO_TAGS_PERMISSION: "Unable to create tags, Unauthorized",
    NO_PERMISSION_TO_UPDATE_TAGS:`You don't have permission to update tags`,
    LIMIT_EXCEEDED: "Document name should not exceed more than 30 characters",
    ALREADY_EXIST: "A folder with same name already exists",
    NO_FOLDER_PERMISSION: "Couldn't create a folder. Unauthorized",
    NO_FOLDER_DELETE_PERMISSION: "Couldn't delete a folder. Unauthorized",
    NO_DELETE_PERMISSION: "Couldn't delete a document. Unauthorized",
    DOC_ALREADY_EXIST: "A document with same name already exists",
    VIEW_PUBLIC_DOCS_DENIED: "Unauthorized to view public documents",
    UNPUBLISH_PUBLIC_DOCUMENT: `You can't unpublish a public document`,
    UNABLE_TO_MAKE_PUBLIC_DOCUMENT: `You can't mark unpublished document as public document`,
    UNABLE_TO_CREATE: "Document creation failed, please try again",
    ADD_TAG_PERMISSION: "You don't have permission to add tags.",
    DOCUMENT_DELETED: (docName: any) => `Document ${docName} is deleted`,
    USER_HAVE_NO_ACCESS: "You don't have permission to access this Document.",
    DOCUMENT_NOT_FOUND: "File not found.",
    DOCUMENT_ID_NOT_FOUND: "Something went wrong. Please try again.",
    DOCUMENTS_NOT_THERE: "Something went wrong. Please try again.",
    SHARE_PUBLISHED_DOCUMENT: "You don't have permission to share this document.",
    INVALID_OR_MISSING_DATA: "Invalid or missing information found. Please try again.",
    INVALID_COLLABORATOR_ACTION: "You can only add Viewers to this document.",
    INVALID_VIEWER_ACTION: "You don't have permission to share this document",
    INVALID_ACTION_TO_REMOVE_SHARE_CAPABILITY: "You don't have permission to remove members",
    PUBLISH_CAPABILITY: "Unauthorized Action."
}

export const COMMENT_ROUTER = {
    MANDATORY: "Please fill all mandatory fields",
}

export const PRIVATE_MEMBER = {
    INVALID: "Group ID is invalid, please try again",
    CREATE: {
        NO_ACCESS: "You don't have permission to create group",
        MISSING_FIELDS: "Please fill all mandatory fileds ",
        INVALID_NAME: "You have entered invalid name, please try again",
        OWNER_NOT_PRIVATE_MEMBER: "Owner can't be added as a group member",
        GROUP_NAME_EXIST: "A private group with same name already exists."
    },
    EDIT: {
        GROUP_NOT_FOUND: "Group not found",
        NO_ACCESS: "You don't have permission to edit group",
        MINIMUM_ONE_USER_REQUIRED: "Minimum one member is required for a group",
        INVALID_NAME: "You have entered invalid group name. please try again.",
        ALREADY_MEMBER: "Member already exist in this group.",
        OWNER_NOT_PRIVATE_MEMBER: "Owner can't be group member.",
    },
    REMOVE: {
        GROUP_NOT_FOUND: "Group Not Found.",
        NO_ACCESS: "You don't have permission to remove group",
        MINIMUM_ONE_USER_REQUIRED: "Minimum one member is required for a group"
    },
    STATUS: {
        GROUP_NOT_FOUND: "Group Not Found.",
        NO_ACCESS: "You don't have permission to delete group" 
    }
}
export const AUTHENTICATE_MSG = {
    MISSING_TOKEN: "Missing token",
    INVALID_TOKEN: "Something went wrong. Please retry",
    INVALID_LOGIN: "Invalid login or password",
    USER_INACTIVE: "User deactivated, please contact the admin"
}

export const MAIL_SUBJECT = {
    INVITE_USER: "Invitation from CITIIS Management Platform",
    FORGOT_PASSWORD: "CMP Reset password instructions",
    LOGIN_SUBJECT: "Login into CMP",
    OTP_SUBJECT: "CMP One Time Password"
};

export const PASSWORD = {
    SPECIAL_CHAR: "Should contain minimum of ",
    NUMBERS_COUNT: "Should contain minimum ",
    SPECIAL_COUNT: "Should contain minimum ",
    TOTAL_LETTERS: (min: number, max: number) => `Password should contain minimum ${min} and maximum ${max} characters `
}

export const RESPONSE = {
    SUCCESS_EMAIL: "Email send successfully.",
    ACTIVE: "active",
    INACTIVE: "inactive",
    ADD_MEMBER: "Group member added",
    REMOVE_MEMBER: "Group member removed",
    UPDATE_PASSWORD: "succefully updated password",
    REPLACE_USER: "successfully replaced.",
    PROFILE_UPDATE: "successfully profile Updated",
    SUCCESS_OTP: "Otp is sent successfully"
}
export const SENDER_IDS = {
    OTP: "CMPOTP",
    FORGOT_OTP: "CMPOTP",
    CHANGE_MOBILE_OTP: "CMPOTP",
    CHANGE_EMAIL_OTP: "CMPOTP"
}
export const MOBILE_TEMPLATES = {
    LOGIN: "Welcome to CMP",
    STATE: "STATE",
    SUGGEST_TAG_NOTIFICATION: "Suggest Tag Notification",
    INVITE_FOR_DOCUMENT: "Invite for Document ",
    APPROVE_TAG_NOTIFICATION: "Approve tag notification",
    REJECT_TAG_NOTIFICATION: "Reject tag notification",
    INVALID_PASSWORD: "Invalid password",
    CHANGE_EMAIL: "Change email",
    DOCUMENT_STATE: (text: string) => `Document ${text}`
}

export const GLOBAL_SCOPE = "global";

export const MISSING = "Missing Field.";

export const ROLE_EXIST = "Role Exist";

export const ROLE_NOT_EXIST = "Role not Exist"

export const INCORRECT_OTP = "OTP is incorrect. Please try again.";

export const TASK_ERROR = {
    UNAUTHORIZED_PERMISSION: `You don't have permission to access this`,
    TASK_NAME_REQUIRED: `Name is mandatory for all tasks`,
    UNAUTHORIZED: `Unauthorized to create task`,
    SUBTASK_UNAUTHORIZED: `Unauthorized to create subtask`,
    ALL_MANDATORY: `Please fill all mandatory fileds`,
    CREATOR_CANT_BE_ASSIGNEE: `Creator cant be owner`,
    INVALID_ARRAY: `tags, approvers, viewers and supporters must be an Array.`,
    ASSIGNEE_REQUIRED: `Assignee is required`,
    ASSIGNEE_ERROR: `Assignee cant be approver or endorser`,
    APPROVERS_EXISTS: `Approvers and endorsers must be different`,
    APPROVERS_REQUIRED: `Approvers are required for compliance task`,
    DUPLICATE_APPROVERS_FOUND: `Duplicate approvers found`,
    DUPLICATE_ENDORSERS_FOUND: `Duplicate endorsers found`,
    USER_NOT_PART_OF_PROJECT: `User not found in project members list`,
    WFM_CREATION_FAILED: `Fail to create WFM.`,
    INVALID_WFM_BY_USER: `Unauthorized to perform this action`,
    INVALID_ACTION_PERFORMED: `Invalid action performed`,
    LINKING_SAME_TASK: `Should not add/link same task`,
    PENDING_SUBTASKS_EXISTS: `All the subtasks to be completed first`,
    CANNOT_REMOVE_APPROVERS: `Some of the approvers or endorsers already approved the task, so they cant be removed`
}

export const PROJECT_ROUTER = {
    MORE_THAN_ONE_RESULT_FOUND: `More than one result found for specified role`,
    TASK_REQUIRED_FOR_LINKING: `Task ID is required to link task to a project`,
    NOT_MEMBER_OF_PROJECT: `User is not a member of this project`,
    PROJECT_NOT_EXISTS: `No such project exists`,
    UNAUTHORIZED_ACCESS: `Unauthorized to perform this action`,
    CITIIS_GRANTS_VALIDATION: `Citiis grants should not exceed project cost`,
    FINANCIAL_INFO_NO_ACCESS:`You don't have access to view Financial info`
}

export const COMPLIANCES = {
    REQUIRED_TASK: `task ID is required to create compliance`,
    UNAUTHORIZED_TO_CREATE: `Unauthorized to create compliance`,
    UNAUTHORIZED_TO_EDIT: `Unauthorized to edit compliance`,
    MISCOMPLIANCE_ERROR: `You are unauthorized to edit miscompliance`
}

export const RISK = {
    UNAUTHORIZED_ACCESS: `Unauthorized to manage risk`
}

export const OPPORTUNITY = {
    UNAUTHORIZED_ACCESS: `Unauthorized to manage opportunity`
}
export const TEMPLATE = {
    INVALID_TEMPLATE: "Email template is invalid, please try again"
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
    UPDATED_FUND_UTILIZATION: `UPDATED_FUND_UTILIZATION`,
    UPDATED_CITIIS_GRANTS: `UPDATED_CITIIS_GRANTS`,
    UPDATED_PROJECT_COST: `UPDATED_PROJECT_COST`,
    REPLACE_USER: `REPLACE_USER`
}