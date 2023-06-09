import {get, post} from "../../utils/requests";
import {BaseContract, ethers} from "ethers";
import {EndPoint} from "../../utils/types/requestTypes";

//经过中间件处理的action所具有的标识
export const FETCH_DATA = "FETCH_DATA";
export const POST_DATA = "POST_DATA";
export const VIEW_CONTRACT = "VIEW_CONTRACT";

export const fetchAPI = () => (next:any) => (action:any) => {
  const callAPI = action[FETCH_DATA];
  if (typeof callAPI === "undefined") {
    return next(action);
  }

  const { endpoint, schema, types } = callAPI;
  if (typeof endpoint.url !== "string") {
    throw new Error("endpoint必须为字符串类型的URL");
  }
  if (typeof endpoint.isProtected !== "boolean") {
    throw new Error("endpoint必须为BOOLEAN类型的URL");
  }

  if (!schema) {
    throw new Error("必须指定领域实体的schema");
  }
  if (!Array.isArray(types) && types.length !== 3) {
    throw new Error("需要指定一个包含了3个action type的数组");
  }
  if (!types.every((type:any) => typeof type === "string")) {
    throw new Error("action type必须为字符串类型");
  }

  const actionWith = (data:any) => {
    const finalAction = { ...action, ...data };
    delete finalAction[FETCH_DATA];
    return finalAction;
  };

  const [requestType, successType, failureType] = types;

  next(actionWith({ type: requestType }));
  return fetchData(endpoint, schema).then(
    (response) =>
      next(
        actionWith({
          type: successType,
          response
        })
      ),
    (error) =>
      next(
        actionWith({
          type: failureType,
          message: error.message || "获取数据失败",
          error: error.error || "获取数据失败",
        })
      )
  );
};

export const postAPI = () => (next:any) => (action:any) => {
  const callAPI = action[POST_DATA];
  if (typeof callAPI === "undefined") {
    return next(action);
  }

  const { endpoint, schema, types, data } = callAPI;
  if (typeof endpoint.url !== "string") {
    throw new Error("endpoint必须为字符串类型的URL");
  }
  if (typeof endpoint.isProtected !== "boolean") {
    throw new Error("endpoint必须为BOOLEAN类型的URL");
  }
  // if (!schema) {
  // 	throw new Error("必须指定领域实体的schema");
  // }
  if (!Array.isArray(types) && types.length !== 3) {
    throw new Error("需要指定一个包含了3个action type的数组");
  }
  if (!types.every((type:any) => typeof type === "string")) {
    throw new Error("action type必须为字符串类型");
  }

  const actionWith = (data:any) => {
    const finalAction = { ...action, ...data };
    delete finalAction[POST_DATA];
    return finalAction;
  };

  const [requestType, successType, failureType] = types;

  next(actionWith({ type: requestType }));
  return postData(endpoint, data, schema).then(
    (response) =>
      next(
        actionWith({
          type: successType,
          response,
          message: response.message,
          payload: data,
        })
      ),
    (error) =>
      next(
        actionWith({
          type: failureType,
          error: error.error || "Failed to post data.",
          code: error.code,
          message: error.message || "Failed to post data.",
        })
      )
  );
};

export const viewContract = () => (next:any) => (action:any) => {
  const callAPI = action[VIEW_CONTRACT];
  if (typeof callAPI === "undefined") {
    return next(action);
  }
  const { contractAddress, abi, provider, types, funcName, params} = callAPI;

  const actionWith = (data:any) => {
    const finalAction = { ...action, ...data };
    delete finalAction[VIEW_CONTRACT];
    return finalAction;
  };

  const [requestType, successType, failureType] : Array<string> = types;

  next(actionWith({ type: requestType }));

  return contractCreator(contractAddress, abi, provider,funcName, params)
      .then(
      (response) =>
          next(
              actionWith({
                type: successType,
                response, params,
                message: "Succeed",
              })
          ),
      (error) =>
          next(
              actionWith({
                type: failureType,
                message: error.message || "Failed Request",
                error: error.reason || "Failed Request",
              })
          )
  );
}

//执行网络请求
const fetchData = (endpoint:EndPoint, schema:any) => {
  //console.log(endpoint);
  return get(endpoint)
    .then((res) => {
      // console.log("normalizeData: ", normalizeData(res, schema));
      // return normalizeData(res, schema);
      return res;
    })
    .catch((error) => Promise.reject(error));
};

const postData = (endpoint:EndPoint, data:any, schema:any) => {
  console.log(endpoint, data, schema);

  return post(endpoint, data)
    .then((res) => {
      if (schema) {
        console.log("normalizeData: ", normalizeData(res, schema));
      }
      return schema ? normalizeData(res, schema) : res;
    })
    .catch((error) => Promise.reject(error));
};

//根据schema, 将获取的数据扁平化处理
export const normalizeData = (rawAPIData:any, schema:any) => {
  let data = rawAPIData;
  console.log(data);
  const { id, name } = schema;
  let kvObj = {};
  let ids = [];
  if (data.data[name]) {
    if (Array.isArray(data.data[name])) {
      // @ts-ignore
      data.data[name].forEach((item) => {
        // @ts-ignore
        kvObj[item[id]] = item;
        ids.push(item[id]);
      });
    } else {
      if (data.data[name][id]) {
        // @ts-ignore
        kvObj[data.data[name][id]] = data.data[name];
        ids.push(data.data[name][id]);
      } else {
        kvObj = data.data[name];
      }
    }
  } else {
    if (Array.isArray(data.data)) {
      // @ts-ignore
      data.data.forEach((item) => {
        // @ts-ignore
        kvObj[item[id]] = item;
        ids.push(item[id]);
      });
    } else if (data.data[id]) {
      // @ts-ignore
      kvObj[data.data[id]] = data.data;
      ids.push(data.data[id]);
    } else {
      kvObj = data.data;
    }
  }

  return {
    [name]: kvObj,
    ids,
    message: data.message,
  };
};

const contractCreator = async (contractAddress:string, abi:any, provider:string,funcName: string, params=[]):Promise<BaseContract> => {
  const contract = new ethers.Contract(contractAddress, abi, ethers.getDefaultProvider(provider));
  console.log(contract)
  return await contract[funcName](...params);
}
