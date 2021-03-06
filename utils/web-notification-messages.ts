export const DOC_NOTIFICATIONS = {
    inviteForDocument: (name: string) => `You are invited by [from] to collaborate on the document ${name}`,
    suggestTagNotification: (name: string) => `You have a tag suggestion on the document ${name} from [from]`,
    approveTagNotification: (name: string, tagNames: string) => `A tag ${tagNames} you suggested has been approved on the document ${name}`,
    approveRemoveTagNotification: (name: string, tagNames: string) => `A tag ${tagNames} you suggested for removal has been approved on the document ${name}`,
    rejectTagNotification: (name: string, tagNames: string) => `A tag ${tagNames} you suggested has been rejected on the document ${name}`,
    rejectRemoveTagNotification: (name: string, tagNames: string) => `A tag ${tagNames} you suggested for removal has been rejected on the document ${name}`,
    addCommentToDoc: (name: string) => `A new comment has been added to the document ${name}`,
    documentUpdate: (text: string, name: string) => `Document ${name} has been updated ${text ? "with " + text : ""}`,
    invitePeopleDoc: (sharedUsers: string, role: string, name: string) => `Your document ${name} on CITIIS Management Platform, is shared with ${sharedUsers} in the capacity of ${role}`,
    publishDocument: (name: string) => `Document ${name} is published`,
    unPublishDocument: (name: string) => `Document ${name} is unpublished`,
    replaceDocument: (name: string) => `Document ${name} is replaced with a new document.`,
    documentRequest: (name: string) => `Someone request your document for access on the document ${name}.`,
    documentRequestApproved: (name: string) => `your request for access was approved on the document ${name}.`,
    documentRequestRejected: (name: string) => `your request for access was rejected on the document ${name}.`,
    documentSuggestTagsModified: (name: string) => `You have new update in tag suggestion on the document ${name} from [from]`,
}

export const GROUP_NOTIFICATIONS = {
    youAddTOGroup: `You are added to a group [groupId]`,
    groupStatus: `Group status for [groupId], which you are a part of, has been updated on CITIIS Management Platform.`,
    addGroupMember: `A new member is added to the user group [groupId] on CITIIS Management Platform.`
}

export const USER_PROFILE = {
    passwordUpdateByAdmin: `Your password has been updated by [from]`,
    emailUpdateByAdmin: `Your email has been updated by [from]`,
    phoneUpdateByAdmin: `Your phone number has been updated by [from]`,
    emailUpdateByUser: `successfully you email has been updated`,
    phoneUpdateByUser: `successfully you phone number has been updated`,
    passwordUpdateByUser: `successfully you password has been updated`,
}

export const PROJECT_NOTIFICATIONS = {
    TRIPART_DATE_UPDATED:(projectName: string) => `Tripart date has been updated for the project ${projectName}`,
    MIS_COMPLIANCE_UPDATED:(projectName: string) => `Miscompliance has been updated for the project ${projectName}`,
    // RISK_CREATED:(projectName: string) => ``,
    PHASES_UPDATED:(projectName: string) => `Phases has been updated for the project ${projectName}`,
    MEMBER_ADDED_TO_PROJECT:(projectName: string) => `You are added to a project ${projectName} on CMP`,
    ADDED_FUND_RELEASE:(projectName: string) => `New fund release has been added to the project ${projectName}`,
    FINANCIAL_INFO_UPDATED:(projectName: string) => `Financial information data has been added to the project ${projectName}`
}