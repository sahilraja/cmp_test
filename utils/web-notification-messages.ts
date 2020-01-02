export const DOC_NOTIFICATIONS = {
    inviteForDocument: `You are invited by [from] to collaborate on the document [docId]`,
    suggestTagNotification: `You have a tag suggestion on the document [docId] from [from]`,
    approveTagNotification: `A document tag you suggested has been approved on the document [docId]`,
    rejectTagNotification: `A document tag you suggested has been rejected on the document [docId]`,
    addCommentToDoc: `A new comment has been added to the document [docId]`,
    documentUpdate: (text: string) => `Document [docId], has been updated with ${text}`,
    invitePeopleDoc: (sharedUsers: string, role: string) => `Your document [docId] on CITIIS Management Platform, is shared with ${sharedUsers} in the capacity of ${role}`,
    publishDocument: `Document [docId], is published on CITIIS Management Platform`,
    unPublishDocument: `Document [docId] is unpublished from CITIIS Management Platform.`,
    replaceDocument: `Document [docId] on CITIIS Management Platform, is replaced with a new document.`
}

export const GROUP_NOTIFICATIONS = {
    youAddTOGroup: `You are added to a user group [groupId], on CITIIS Management Platform.`,
    groupStatus: `Group status for [groupId], which you are a part of, has been updated on CITIIS Management Platform.`,
    addGroupMember: `A new member is added to the user group [groupId] on CITIIS Management Platform.`
}