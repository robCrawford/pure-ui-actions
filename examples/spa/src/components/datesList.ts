import { component, html, memo, VNode } from "pure-ui-actions";
const { div, input, ul, li, button } = html;

export type Props = Readonly<Record<string, never>>;

export type State = Readonly<{
  filterText: string;
  selectedDate: string | null;
  showInfo: boolean;
}>;

type ActionPayloads = Readonly<{
  SetFilter: null;
  SelectDate: null;
  ToggleInfo: null;
}>;

export type Component = { Props: Props; State: State; ActionPayloads: ActionPayloads };

type DateItem = Readonly<{ id: string; label: string }>;

const allDates: DateItem[] = ((): DateItem[] => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(year, month, i + 1);
    return {
      id: date.toISOString().split("T")[0],
      label: date.toLocaleDateString("en-US", { weekday: "long", day: "numeric" })
    };
  });
})();

const filterDates = (filter: string): DateItem[] =>
  filter.trim()
    ? allDates.filter((d) => d.label.toLowerCase().includes(filter.toLowerCase().trim()))
    : allDates;

// Memoized render function
const renderList = (filter: string, selected: string | null, onClick: (e: Event) => void): VNode =>
  ul(
    ".dates-list",
    { on: { click: onClick } },
    filterDates(filter).map((d) =>
      li({ key: d.id, attrs: { "data-id": d.id }, class: { selected: selected === d.id } }, d.label)
    )
  );

export default component<Component>(({ action }) => ({
  state: (): State => ({ filterText: "", selectedDate: null, showInfo: true }),

  actions: {
    SetFilter: (_, { state, event }): { state: State } => ({
      state: {
        ...state,
        filterText: ((event?.target as { value?: string })?.value as string) ?? ""
      }
    }),
    SelectDate: (_, { state, event }): { state: State } => {
      const id = (event?.target as HTMLElement)?.closest("[data-id]")?.getAttribute("data-id");
      return id && id !== state.selectedDate
        ? { state: { ...state, selectedDate: id } }
        : { state };
    },
    ToggleInfo: (_, { state }): { state: State } => ({
      state: { ...state, showInfo: !state.showInfo }
    })
  },

  view(id, { state }): VNode {
    const filtered = filterDates(state.filterText);
    return div(`#${id}.dates-picker`, [
      div(".ui-row", [
        input(`#${id}-filter`, {
          props: { type: "text", value: state.filterText, placeholder: "Filter by day or date..." },
          on: { input: action("SetFilter") }
        })
      ]),
      div(".ui-row", [
        button(".help-toggle", { on: { click: action("ToggleInfo") } }, "ⓘ"),
        state.showInfo
          ? div(".dates-info", `Showing ${filtered.length} of ${allDates.length} days`)
          : null
      ]),
      // Memoized: re-renders on filter/selection change, but NOT when toggling info
      memo("ul.dates-list", "dates-list", renderList, [
        state.filterText,
        state.selectedDate,
        action("SelectDate")
      ])
    ]);
  }
}));
