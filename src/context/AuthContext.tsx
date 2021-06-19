import { createContext, ReactNode, useEffect, useState } from "react";
import { setCookie, parseCookies, destroyCookie } from "nookies";
import router from "next/router";
import { api } from "../services/apiClient";

type User = {
  email: string;
  permissions: string[];
  roles: string[];
};

type SingInCredentials = {
  email: string;
  password: string;
};

type AuthContextData = {
  signIn(credentials: SingInCredentials): Promise<void>;
  user: User;
  isAuthenticated: boolean;
};

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthContext = createContext({} as AuthContextData);

export function signOut() {
  destroyCookie(undefined, "nextauth.token");
  destroyCookie(undefined, "nextauth.refreshToken");

  router.push("/");
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User>();
  // Por padrão o user é um valor falso, então se eu nego o valor falso ele fica true
  const isAuthenticated = !!user;

  useEffect(() => {
    // Devolve lista de cookies salvos
    const { "nextauth.token": token } = parseCookies();

    if (token) {
      api
        .get("/me")
        .then((response) => {
          const { email, permissions, roles } = response.data;

          // Esses dados estão sendo salvo apenas dentro da pagina de login
          setUser({
            email,
            permissions,
            roles,
          });
        })
        .catch(() => {
          signOut();
        });
    }
  }, []);

  async function signIn({ email, password }: SingInCredentials) {
    try {
      const response = await api.post("sessions", {
        email,
        password,
      });

      const { permissions, roles, token, refreshToken } = response.data;

      //Mantando os dados do usuário mesmo ele dando refresh na pagina
      setCookie(undefined, "nextauth.token", token, {
        // 30 dias, o tempo que quero armazenar esses dados no navegador
        maxAge: 60 * 60 * 24 * 30,
        // Quais caminho da minha aplicação vai ter acesso ap cookies, qualquer endereço da aplicação vai ter acesso.
        path: "/",
      });

      setCookie(undefined, "nextauth.refreshToken", refreshToken, {
        maxAge: 60 * 60 * 24 * 30, // 30 dias
        path: "/",
      });

      setUser({
        email,
        permissions,
        roles,
      });

      api.defaults.headers["Authorization"] = ` Bearer ${token}`;

      router.push("/dashboard");
    } catch (error) {
      console.log(error);
    }
  }

  return (
    <AuthContext.Provider value={{ signIn, isAuthenticated, user }}>
      {children}
    </AuthContext.Provider>
  );
}
