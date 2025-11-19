import { component, html, Config, VNode, Task } from "pure-ui-actions";
import counterPage from "./pages/counterPage";
import aboutPage from "./pages/aboutPage";
import "./router";
const { div } = html;

export type RootProps = Readonly<Record<string, never>>;

export type RootState = Readonly<{
  theme: Theme;
  page?: Page;
  likes: {
    counterPage: number;
    aboutPage: number;
  };
}>;

export type RootActions = Readonly<{
  SetPage: { page: Page };
  SetTheme: { theme: Theme };
  Like: { page: Page };
}>;

export type RootTasks = Readonly<{
  SetDocTitle: { title: string };
}>;

export type Page = "counterPage" | "aboutPage";

export type Theme = "light" | "dark";

type Component = {
  Props: RootProps;
  State: RootState;
  Actions: RootActions;
  Tasks: RootTasks;
};


export default component<Component>(
  (): Config<Component> => ({

    state: (): RootState => ({
      theme: "light",
      page: undefined,
      likes: {
        counterPage: 0,
        aboutPage: 0
      }
    }),

    actions: {
      SetPage: ({ page }, { state }): { state: RootState } => {
        return {
          state: page === state.page ? state : {
            ...state,
            page
          }
        };
      },
      SetTheme: ({ theme }, { state }): { state: RootState } => {
        return {
          state: theme === state.theme ? state : {
            ...state,
            theme
          }
        };
      },
      Like: ({ page }, { state }): { state: RootState } => {
        return {
          state: {
            ...state,
            likes: {
              ...state.likes,
              [ page ]: state.likes[ page ] + 1
            }
          }
        };
      }
    },

    tasks: {
      // Demonstrates a task that is only an effect
      SetDocTitle: ({ title }) => ({
        perform: (): void => {
          document.title = title;
        }
      })
    },

    view(id, { state }): VNode {
      return div(`#${id}.page.${state.theme}`,
        ((): VNode => {
          switch (state.page) {
          case "aboutPage":
            return aboutPage("#about-page");

          case "counterPage":
            return counterPage("#counter-page");
          }
        })()
      );
    }

  })
);
