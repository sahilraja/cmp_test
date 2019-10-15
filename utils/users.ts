import * as request from "request-promise";
import * as http from "http";

const USERS_URL = process.env.USERS_URL || "http://localhost:4000";
const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || "http://localhost:4040";

// create user
export async function createUser(body: any) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/create`,
            method: "POST",
            body: body,
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

// user Login
export async function userLogin(body: any) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/login`,
            method: "POST",
            body: body,
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

// user find One
export async function userFindOne(key: string, value: string, selectFields?: any) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/findOne`,
            method: "POST",
            body: { key, value, selectFields: selectFields || {} },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};
export async function changeEmailRoute(userId:string,objBody:object){
    try {
        let Options = {
            uri: `${USERS_URL}/user/changeEmail/${userId}`,
            method: "POST",
            body: objBody,
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };

}

export async function userUpdate(objBody: any) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/update`,
            method: "POST",
            body: objBody,
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

// user Login
export async function userFindMany(key: string, value: any[], selectFields?: any) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/findMany`,
            method: "POST",
            body: {
                key,
                value,
                selectFields: selectFields || {}
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

export async function getNamePatternMatch(queryString: string, selectFields: object) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/patternMatch`,
            method: "POST",
            body: {
                searchKeys: ['name', 'firstName', 'lastName', 'middleName', 'secondName'],
                searchQuery: queryString,
                selectFields: selectFields || {}
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
}

// user List
export async function userList(searchQuery: any, selectFields?: any) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/list`,
            method: "POST",
            body: {
                searchQuery: searchQuery,
                selectFields: selectFields || {}
            },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

export async function verifyJWT(token: string) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/verifyJWT`,
            method: "POST",
            body: { token },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

export async function createJWT(payload: object) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/createToken`,
            method: "POST",
            body: payload,
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

export async function userEdit(userId: string, payload: any) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/${userId}/edit`,
            method: "POST",
            body: payload,
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

export async function userPaginatedList(searchQuery: any, selectFields?: any, page?: number, limit?: number, sort?: string, ascending?: boolean) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/paginatedList`,
            method: "POST",
            body: { searchQuery, selectFields, page, limit, sort, ascending },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

export async function userDelete(userId: string) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/${userId}`,
            method: "DELETE",
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};
export async function uploadPhoto(request: any) {
    const options: any = {
        hostname: 'localhost',
        port: 4040,
        path: '/photo',
        method: 'POST',
        headers: request.headers
    };
    return new Promise((resolve, reject) => {
        const req = http.request(options, res => {
            // response.writeHead(200, res.headers);
            res.setEncoding('utf8');
            let content = '';
            res.on('data', (chunk) => {
                content += chunk;
            });
            res.on('end', () => {
                resolve(content);
            });
        });
        req.on('error', (e) => {
            console.error(e);
        });
        request.pipe(req);
    });
}

export async function changePasswordInfo(payload:object,userId:string){
    try {
        let Options = {
            uri: `${USERS_URL}/user/changePassword/${userId}`,
            method: "POST",
            body: payload,
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };

}

//  group apis-----------------

export async function groupCreate(payload: any) {
    try {
        let Options = {
            uri: `${USERS_URL}/group/create`,
            method: "POST",
            body: payload,
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

export async function listGroup(searchQuery: object, selectFields?: object, sort?: string) {
    try {
        let Options = {
            uri: `${USERS_URL}/group/list`,
            method: "POST",
            body: { searchQuery, selectFields: selectFields || {}, sort: sort || undefined },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

export async function groupFindOne(key: string, value: string, selectFields?: object) {
    try {
        let Options = {
            uri: `${USERS_URL}/group/findOne`,
            method: "POST",
            body: { key, value, selectFields: selectFields || undefined },
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

export async function groupEdit(groupId: string, payload: object) {
    try {
        let Options = {
            uri: `${USERS_URL}/group/${groupId}/detail`,
            method: "PUT",
            body: payload,
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

export async function otpVerify(objBody: string) {
    try {
        let Options = {
            uri: `${USERS_URL}/user/otpVerify`,
            method: "POST",
            body: objBody,
            json: true
        }
        return await request(Options);
    } catch (err) {
        throw err
    };
};

