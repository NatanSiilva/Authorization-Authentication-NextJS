import axios, { AxiosError } from "axios";
import { error } from "console";
import { parseCookies, setCookie } from "nookies";

let cookies = parseCookies();
let isRefreshing = false;
let failedRequestQueue = [];

export const api = axios.create({
  baseURL: "http://localhost:3333",
  headers: {
    Authorization: `Bearer ${cookies["nextauth.token"]}`,
  },
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response.status === 401) {
      {
        if (error.response.data?.code === "token.expired") {
          // renovar o token
          cookies = parseCookies();

          const { "nextauth.refreshToken": refreshToken } = cookies;

          const originalConfig = error.config;

          if (!isRefreshing) {
            isRefreshing = true; // so faz refreshToken uma única vez

            api
              .post("/refresh", { refreshToken })
              .then((response) => {
                const { token } = response.data;

                setCookie(undefined, "nextauth.token", token, {
                  maxAge: 60 * 60 * 24 * 30,
                });

                setCookie(
                  undefined,
                  "nextauth.refreshToken",
                  response.data.refreshToken,
                  {
                    maxAge: 60 * 60 * 24 * 30, // 30 dias
                    path: "/",
                  }
                );

                api.defaults.headers["Authorization"] = ` Bearer ${token}`;

                failedRequestQueue.forEach((request) =>
                  request.onSuccess(token)
                );

                failedRequestQueue = [];
              })
              .catch((err) => {
                failedRequestQueue.forEach((request) => request.onFailure(err));
              })
              .finally(() => {
                isRefreshing = false;
              });
          }

          return new Promise((resolve, reject) => {
            failedRequestQueue.push({
              onSuccess: (token: string) => {
                originalConfig.headers["Authorization"] = `Bearer ${token}`;

                resolve(api(originalConfig));
              },

              onFailure: (err: AxiosError) => {
                reject(err);
              },
            });
          });
        } else {
          // deslogar o usuário
        }
      }
    }
  }
);

// Quando o interceptors identificar que o token ta expirado, ele vai automaticamente pausar todas requisições que estão sendo feitas ao mesmo tempo e todas as requisições que vierem no futuro, até o token está realmente atualizado. Depois ele vai pegar aquelas requisições que não foram feitas porque o token não estava atualizado, vai executar elas novamente só que agora com o token atualizado. Vamos cria basicamente uma fila de requisições, essa fila vai armazenar todas as requisições que foram feitas para o back-end.
