import { UNAUTHORIZED } from "http-status-codes";

export const USER_ROUTER = {
    INVALID_USER: "Please enter valid login credentials",
    INVALID_ADMIN: "You don't have permissions to perform this action",
    CREATE_ROLE_FAIL: "[Error: 0001] Role couldn't be created, please try again",
    REVOKE_ROLE_FAIL: "[Error: 0002] Failed to remove role, Please retry",
    TOKEN_MISSING: "[Error: 0003] Token not found, please try again",
    TOKEN_INVALID: "[Error: 0004] Token invalid, please try again",
    SOMETHING_WENT_WRONG: "[Error: 0005] Something went wrong. Please retry",
    MANDATORY: "Please fill all mandatory fields",
    VALID_PHONE_NO: "Please enter valid phone number",
    VALID_PASSWORD: "Password must have one special character and at least 6 characters",
    ALREADY_REGISTER: "You are already registered, please use login functionality",
    INVALID_PARAMS_ID: "[Error: 0006] Invalid user ID. Please try again",
    USER_NOT_EXIST: "User doesn't exist, please contact CMP administrator",
    INVALID_FIELDS: "Please enter valid Email ID/Password",
    USER_NOT_REGISTER: "User is not registered",
    INVALID_LOGIN_DETAILS: "Invalid login or password",
    DEACTIVATED_BY_ADMIN: "Your account has been deactivated, please contact the admin to reactivate",
    ROLE_NOT_FOUND: "[Error: 0007] Failed to fetch user details",
    CAPABILITIES_NOT_FOUND: "[Error: 0008] Failed to fetch access privileges",
    EMAIL_VERIFIED: "Email ID is already verified",
    EMAIL_WRONG: "Invalid email ID, please enter a valid email ID",
    GROUP_NOT_FOUND: "Please enter a valid group name",
    USER_ARRAY: "[Error: 0009] Users must be an array list",
    ABOUTME_LIMIT: "Please limit the response to {} characters",
    SIMILAR_MOBILE: "This mobile number exists. Please add a new mobile number",
    INVALID_PASSWORD: "Please enter valid password",
    INVALID_OTP: "Invalid OTP: Please enter valid OTP sent to your email address",
    INVALID_COUNTRYCODE: "Given country code is invalid",
    CREATE_ROLE_NOTIFICATION_FAIL: "[Error: 0010] Failed to create notification",
    ADD_NOTIFICATION_FAIL: "[Error: 0011] Failed to add template to notification",
    BOTH_INVALID: "Invalid OTP: Please enter valid OTP",
    TOKEN_EXPIRED: "Verification link has expired. Please contact admin to send the link again",
    TOKEN_EXPIRED_OTP: "[Error: 0012] OTP verification link is expired",
    USER_EXIST: "User already registered",
    CONSTANT_INVALID: "[Error: 0013] Constant type is invalid, please try again",
    RECAPTCHA_INVALID: "Captcha Verification failed, please try again",
    VALID_EMAIL: "Please enter valid email ID",
    NAME_ERROR: "[Error: 0014] Invalid name entered, please try again",
    INVALID_EMAIL_TEMP: `Email template is invalid, please try again`,
    UPLOAD_EMPTY_FOLDER: `[Error: 0015] Uploaded empty document`,
    NO_ROLE_MATCH: (role: string) => `[Error: 0016] No role matched with ${role}`,
    EMAIL_EXIST: (email: string) => `[Error: 0017] ${email} already exists`,
    CATEGORY_NOT_MATCH: (category: string) => `[Error: 0017] No category matched with ${category}`,
    CATEGORY_REQUIRE_ALL_MANDATORY: `[Error: 0018] Category, role and email ID are mandatory`,
    INVALID_EMAIL: (email: string) => `[Error: 0019] ${email} is invalid`,
    DISABLED_BULK_UPLOAD: `[Error: 0020] Bulk upload disabled`,
    MINIMUM_ONE_ROLE: "[Error: 0021] Minimum one role is required",
    INVALID_ACTION: "[Error: 0022] Invalid Action",
    PASSWORD_VALIDATION_UPPERCASE: (SPECIAL_CHAR: any, UPPER_CASE_COUNT: any) => `${SPECIAL_CHAR} ${UPPER_CASE_COUNT} Capital letters`,
    PASSWORD_VALIDATION_NUMBER: (PASSOWRD_NUMBERS_COUNT: any, NUMBERS_COUNT: any) => `${PASSOWRD_NUMBERS_COUNT} ${NUMBERS_COUNT} Numbers`,
    PASSWORD_VALIDATION_SPECIALCHAR: (PASSWORD_SPECIAL_COUNT: any, SPECIAL_COUNT: any) => `${PASSWORD_SPECIAL_COUNT} ${SPECIAL_COUNT} Special Characters`
};
export const GROUP_ROUTER = {
    REMOVE_MEMBER: "Please add at least one member to the group",
    GROUP_NAME: "Group name cannot be modified"
}
export const MOBILE_MESSAGES = {
    VALID_MOBILE_OTP: "Please enter a valid OTP",
    SEND_OTP: "OTP sent successfully",
    VALID_OTP: "OTP is verified",
    INVALID_OTP: "Invalid OTP: Please enter valid OTP sent to your mobile number",
}

export const FINANCIAL_INFO = {
    MANDATORY: "Please fill all mandatory fields",
    PHASE_EXIST: "A phase with same name exists",
    PHASE_NOT_FOUND: "[Error: 0023] Phase details not found" 
}

export const DOCUMENT_ROUTER = {
    FILE_SIZE: (size: number) => `File size shouldn't exceed ${size} MB`,
    DOCUMENT_NAME_LENGTH: (nameLength: number) => `Document name should not exceed more than ${nameLength} characters`,
    DOCUMENT_DESCRIPTION_LENGTH: (descriptionLenth: number) => `Document description should not exceed more than ${descriptionLenth} characters`,
    DOCUMENT_NAME_UNIQUE: (name: string) => `A document with name "${name}" already exists, please enter a unique name`,
    NAME_ERROR: "[Error: 0024] You have entered an invalid name, please try again",
    MANDATORY: "Please fill all mandatory fields",
    CREATE_ROLE_FAIL: "[Error: 0025] Role creation failed, please contact CMP admin",
    CHILD_NOT_FOUND: "[Error: 0026] Something went wrong. Please try again.",
    DOCID_NOT_VALID: "[Error: 0027] Document ID is invalid",
    FILE_NOT_FOUND: "Document upload is mandatory",
    INVALID_ADMIN: "[Error: 0028] You don't have permission to perform this action",
    INVALID_UPDATE_USER: "You don't have permission to update this document",
    NO_PERMISSION: "You don't have permission to create a document",
    NO_TAGS_PERMISSION: "You don’t have permission to create tags",
    NO_PERMISSION_TO_UPDATE_TAGS: `You don't have permission to update tags`,
    LIMIT_EXCEEDED: "Document name should not exceed more than 30 characters",
    ALREADY_EXIST: "A folder with same name already exists",
    NO_FOLDER_PERMISSION: "You don’t have permission to create folders",
    NO_FOLDER_DELETE_PERMISSION: "You don’t have permission to delete folders",

    NO_DELETE_PERMISSION: "You don’t have permission to delete documents",
    DOC_ALREADY_EXIST: "A document with same name already exists",
    VIEW_PUBLIC_DOCS_DENIED: "You don’t have permission to view public documents",
    UNPUBLISH_PUBLIC_DOCUMENT: `You can't unpublish a public document`,
    UNABLE_TO_MAKE_PUBLIC_DOCUMENT: `You can't mark unpublished document as a public document`,
    UNABLE_TO_CREATE: "[Error: 0028] Document creation failed, please try again",
    ADD_TAG_PERMISSION: "You don't have permission to add tags",
    DOCUMENT_DELETED: (docName: any) => `Document ${docName} is deleted`,
    USER_HAVE_NO_ACCESS: "You don't have permission to access this document",
    DOCUMENT_NOT_FOUND: "[Error: 0029] File not found",
    DOCUMENT_ID_NOT_FOUND: "[Error: 0030] Document ID not found, please try again",
    DOCUMENTS_NOT_THERE: "[Error: 0031] Document not found, please try again",
    SHARE_PUBLISHED_DOCUMENT: "[Error: 0032] You don't have permission to share this document",
    INVALID_OR_MISSING_DATA: "[Error: 0033] Invalid or missing information found, please try again",
    INVALID_COLLABORATOR_ACTION: "You can only add viewers to this document",
    INVALID_VIEWER_ACTION: "You don't have permission to share this document",
    INVALID_ACTION_TO_REMOVE_SHARE_CAPABILITY: "You don't have permission to remove members",
    PUBLISH_CAPABILITY: "You don’t have permission to publish this document",
    MISSING_COLLABORATOR: "[Error: 0034] Collaborators not found",
    USER_ALREADY_THIS_PERMISSION: (user: string) => `${user} already has these permissions`,
    FOLDER_NOT_FOUND: "[Error: 0035] Folder doesn't exist",
    INVALID_FILE_ID: "[Error: 0036] File ID is invalid",
    PUBLISH_CANT_BE_DELETE: "Published document can't be deleted",
    TAG_REQUIRED: "Tags are required",
    UNAUTHORIZED: "[Error: 0034] You don’t have permission to perform this action",
    INVALID_ACTION_PERFORMED: "[Error: 0035] Invalid action performed, please contact CMP admin",
    SOMETHING_WENT_WRONG: "[Error: 0036] Something went wrong, please retry",
    ALREADY_REQUEST_EXIST: "[Error: 0037] Request is already in progress",
    
    UPLOAD_EMPTY_FOLDER: `[Error: 0015] Uploaded empty document`,

}

export const NOTIFICATION = {
    TEMPLATE_NOT_FOUND: "Email template is not found"
}

export const PATTERNS = {
    UNAUTHORIZED: "[Error: 0038] You don’t have permission to perform this action",
    INVALID_OR_MISSING_DATA: "[Error: 0039] Invalid or missing information found, please try again",
    PATTERN_WITH_SAME_NAME: "[Error: 0040] A pattern with the same name already exists",
    PATTERNS_DETAILS_NOT_FOUND: "Pattern details not found"
}

export const COMMENT_ROUTER = {
    MANDATORY: "Please fill all mandatory fields",
    UNAUTHORIZED: "[Error: 0041] You don’t have permission to perform this action",
    INVALID_OR_MISSING_DATA: "[Error: 0042] Invalid or missing information found, please try again",
}

export const PRIVATE_MEMBER = {
    INVALID: "[Error: 0043] Private Member List ID is invalid, please try again",
    CREATE: {
        NO_ACCESS: "You don't have permission to create a Private Member List",
        MISSING_FIELDS: "Please fill all mandatory fields",
        INVALID_NAME: "[Error: 0044] You have entered an invalid name, please try again",
        OWNER_NOT_PRIVATE_MEMBER: "Owner can't be added to a Private Member List",
        GROUP_NAME_EXIST: "A Private Member List with the same name already exists"
    },
    EDIT: {
        GROUP_NOT_FOUND: "[Error: 0045] Private Member List not found",
        NO_ACCESS: "You don't have permission to edit Private Member List",
        MINIMUM_ONE_USER_REQUIRED: "At least one member is required to create a Private Member List",
        INVALID_NAME: "[Error: 0046] You have entered an invalid name, please try again",
        ALREADY_MEMBER: "Member already exists in this Private Member List",
        OWNER_NOT_PRIVATE_MEMBER: "Owner can't be added to a Private Member List",
    },
    REMOVE: {
        GROUP_NOT_FOUND: "[Error: 0047] Private Member List not found",
        NO_ACCESS: "You don't have permission to remove Private Member List",
        MINIMUM_ONE_USER_REQUIRED: "At least one member is required in a Private Member List"
    },
    STATUS: {
        GROUP_NOT_FOUND: "[Error: 0048] Private Member List not found",
        NO_ACCESS: "You don't have permission to delete Private Member List"
    }
}
export const AUTHENTICATE_MSG = {
    MISSING_TOKEN: "[Error: 0049] Token not found",
    INVALID_TOKEN: "[Error: 0050] Token is invalid, please try again",
    INVALID_LOGIN: "Invalid login or password",
    USER_INACTIVE: "User deactivated, please contact CMP admin"
}

export const MAIL_SUBJECT = {
    INVITE_USER: "Invitation from CITIIS Management Platform",
    FORGOT_PASSWORD: "CMP Reset Password Instructions",
    LOGIN_SUBJECT: "[CMP] Login",
    OTP_SUBJECT: "[CMP] One Time Password"
};

export const PASSWORD = {
    SPECIAL_CHAR: "Should contain minimum of ",
    NUMBERS_COUNT: "Should contain minimum ",
    SPECIAL_COUNT: "Should contain minimum ",
    TOTAL_LETTERS: (min: number, max: number) => `Password should contain minimum ${min} and maximum ${max} characters `
}

export const RESPONSE = {
    SUCCESS_EMAIL: "Email sent successfully",
    ACTIVE: "active",
    INACTIVE: "inactive",
    ADD_MEMBER: "Group member added",
    REMOVE_MEMBER: "Group member removed",
    UPDATE_PASSWORD: "Password updated successfully",
    REPLACE_USER: "User replaced successfully",
    PROFILE_UPDATE: "Profile updated successfully",
    SUCCESS_OTP: "OTP sent successfully"

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
    APPROVE_TAG_NOTIFICATION: "Approve Tag Notification",
    REJECT_TAG_NOTIFICATION: "Reject Tag Notification",
    INVALID_PASSWORD: "Invalid password",
    CHANGE_EMAIL: "Change email",
    DOCUMENT_STATE: (text: string) => `Document ${text}`
}

export const GLOBAL_SCOPE = "global";

export const OTP_BYPASS = "0987";

export const MISSING = "Missing Field";

export const ROLE_EXIST = "Role Exists";

export const ROLE_NOT_EXIST = "Role doesn’t Exist"

export const INCORRECT_OTP = "OTP is incorrect. Please try again.";

export const UNAUTHORIZED_ACTION = "Unauthorized Action."

export const TASK_ERROR = {
    INVALID_STEP:`Invalid step`,
    INVALID_PILLAR:`Invalid pillar`,
    STEP_IS_REQUIRED:`Step is required`,
    PILLAR_IS_REQUIRED:`Pillar is required`,
    UNAUTHORIZED_PERMISSION: `You don't have permission to access this feature`,
    TASK_NAME_REQUIRED: `Name is mandatory for all tasks`,
    UNAUTHORIZED: `You don't have permission to create tasks`,
    SUBTASK_UNAUTHORIZED: `You don't have permission to create subtasks`,
    ALL_MANDATORY: `Please fill all mandatory fields`,
    CREATOR_CANT_BE_ASSIGNEE: `Task creator can’t be an owner, please assign to another user`,
    INVALID_ARRAY: `[Error: 0051] Tags, approvers, viewers and supporters must be an array list`,
    ASSIGNEE_REQUIRED: `Assignee is required`,
    ASSIGNEE_ERROR: `Assignee can’t be an approver or endorser of the same task`,
    APPROVERS_EXISTS: `Approvers and endorsers must be different for the same task`,
    APPROVERS_REQUIRED: `Approvers are required for compliance tasks`,
    DUPLICATE_APPROVERS_FOUND: `[Error: 0052] Duplicate approvers found`,
    DUPLICATE_ENDORSERS_FOUND: `[Error: 0053] Duplicate endorsers found`,
    USER_NOT_PART_OF_PROJECT: `User not found in the list of core team`,
    WFM_CREATION_FAILED: `[Error: 0054] Failed to create WFM`,
    INVALID_WFM_BY_USER: `[Error: 0055] You don’t have permission to perform this action`,
    INVALID_ACTION_PERFORMED: `[Error: 0056] Invalid action performed`,
    LINKING_SAME_TASK: `[Error: 0057] You can’t add/link the same task to itself`,
    PENDING_SUBTASKS_EXISTS: `You can’t complete this task unless all its subtasks are completed or cancelled`,
    CANNOT_REMOVE_APPROVERS: `This task is already approved. Approver/ Endorser can't be updated at this stage`
}

export const PROJECT_ROUTER = {
    SELECT_PHASE: "Please provide phase name.",
    MORE_THAN_ONE_RESULT_FOUND: `[Error: 0058] More than one result found for specified role`,
    TASK_REQUIRED_FOR_LINKING: `[Error: 0059] Task ID is required to link task to a project`,
    NOT_MEMBER_OF_PROJECT: `User not found in the list of core team`,
    PROJECT_NOT_EXISTS: `[Error: 0059] Project doesn’t exist`,
    UNAUTHORIZED_ACCESS: `[Error: 0060] You are not authorized to perform this action`,
    CITIIS_GRANTS_VALIDATION: `CITIIS grant can’t exceed the project cost`,
    FINANCIAL_INFO_NO_ACCESS: `You don't have permission to view financial information`,
    PHASE_REQUIRED: `Phase is required`,
    PERCENTAGE_REQUIRED: `Percentage is required`,
    PERCENTAGE_NOT_EXCEED: `Percentage should be 100`,
    INSTALLMENT_REQUIRED: `Installment is required`,
    CITIISGRANTS_NOT_EXCEED: "Released amount can’t exceed CITIIS grant amount",
    TOTAL_RELEASED_EXCEED_CITIIS:`Total released amount can't exceed CITIIS grant amount`,
    UTILIZED_AMOUNT_EXCEED_RELEASED:`Utilized amount can't exceed Released amount`,
    CANNOT_REMOVE_RELEASED_AMOUNT: `You can't remove released amount after utilized amount is added`,
    CITIISGRANTS_NOT_EXCEED_AMOUNT: (cumulativeDifference: any) => `Released amount exceeded CITIIS grant amount, Exceeded Amount is ${cumulativeDifference}`,
    CITIISGRANTS_NOT_LESS_AMMOUNT: (cumulativeDifference: any) => `Released Amount is less than CITIIS grant amount,Please add ${cumulativeDifference} amount`,
    START_DATE_LESS_THAN: "Start date can’t exceed the end date",
    USER_ADD_PROJECT_MEMBER: `You are not allowed to add yourself as a Project Core Team Member`,
    NOT_VALID_DOC: "[Error: 0061] Invalid sheet",
    EMPTY_DOC: `[Error: 0062] Empty document uploaded`,
    ASSIGNEE_REQUIRED_TASK: (name: any) => `Assignee is required for task ${name}`,
    ASSIGNEE_NOT_EXIST: (name: string) => `Assignee not exists for task ${name}`,
    APPROVER_NOT_EXIST: (errorRole: any, name: any) => `Approver ${errorRole} doesn’t exist for the task ${name}`,
    ENDORSER_NOT_EXIST: (errorRole: any, name: any) => `Endorser ${errorRole} doesn’t exist for the task ${name}`,
    VIEWER_NOT_EXIST: (errorRole: any, name: any) => `Viewer ${errorRole} doesn’t exist for the task ${name}`,
    CITIIS_NOT_LESS_RELEASED: "Released amount can’t exceed CITIIS grant amount",
    USER_ID_REQURED: `User ID is required`,
    PHASE_BEFORE_END_DATE: `Start date can’t exceed the end date`,
    PHASE_OVER_LAP: `There shouldn't be any gap or overlap between phases`,
    UPLOAD_VALID_FORMAT: `Please upload valid xlsx/csv file`,
    START_DATE_NOT_IN_PAST: "Start date can’t be in the past",
    START_NOT_LESS_THAN_DUE: "Start date can’t exceed the due date",
    INVALID_PROJECT_ID: "[Error: 0063] Invalid Project ID",
    MANDATORY: "Please fill all mandatory fields",
    PROJECTS_NOT_THERE: "[Error: 0063] Project not found"
}

export const COMPLIANCES = {
    REQUIRED_TASK: `[Error: 0064] Task ID is required to create compliance`,
    UNAUTHORIZED_TO_CREATE: `You do not have permissions to create compliance`,
    UNAUTHORIZED_TO_EDIT: `You do not have permissions to edit compliance`,
    MISCOMPLIANCE_ERROR: `You do not have permissions to edit compliance`
}

export const RISK = {
    UNAUTHORIZED_ACCESS: `You do not have permissions to manage risks`
}

export const OPPORTUNITY = {
    UNAUTHORIZED_ACCESS: `You do not have permissions to manage opportunities`
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