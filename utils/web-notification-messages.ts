export const DOC_NOTIFICATIONS = {
    inviteForDocument: (name: string) => `You are invited by [from] to collaborate on the document ${name}`,
    suggestTagNotification: (name: string) => `You have a tag suggestion on the document ${name} from [from]`,
    approveTagNotification: (name: string) => `A document tag you suggested has been approved on the document ${name}`,
    rejectTagNotification: (name: string) => `A document tag you suggested has been rejected on the document ${name}`,
    addCommentToDoc: (name: string) => `A new comment has been added to the document ${name}`,
    documentUpdate: (text: string, name: string) => `Document ${name}, has been updated ${text ? "with " + text : ""}`,
    invitePeopleDoc: (sharedUsers: string, role: string, name: string) => `Your document ${name} on CITIIS Management Platform, is shared with ${sharedUsers} in the capacity of ${role}`,
    publishDocument: (name: string) => `Document ${name}, is published on CITIIS Management Platform`,
    unPublishDocument: (name: string) => `Document ${name} is unpublished from CITIIS Management Platform.`,
    replaceDocument: (name: string) => `Document ${name} on CITIIS Management Platform, is replaced with a new document.`
}

export const GROUP_NOTIFICATIONS = {
    youAddTOGroup: `You are added to a user group [groupId], on CITIIS Management Platform.`,
    groupStatus: `Group status for [groupId], which you are a part of, has been updated on CITIIS Management Platform.`,
    addGroupMember: `A new member is added to the user group [groupId] on CITIIS Management Platform.`
}