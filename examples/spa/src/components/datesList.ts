import { component, html, VNode } from "pure-ui-actions";
const { div, input, ul, li } = html;

export type Props = Readonly<Record<string, never>>;

export type State = Readonly<{
  filterText: string;
  selectedDate: string | null;
}>;

type ActionPayloads = Readonly<{
  SetFilter: null;
  SelectDate: { id: string };
}>;

export type Component = {
  Props: Props;
  State: State;
  ActionPayloads: ActionPayloads;
};

type DateItem = Readonly<{
  id: string;
  dayName: string;
  dayNum: number;
  label: string;
}>;

function getDatesInMonth(): DateItem[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const dates: DateItem[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayName = dayNames[date.getDay()];
    dates.push({
      id: `${year}-${month + 1}-${day}`,
      dayName,
      dayNum: day,
      label: `${dayName} ${day}`
    });
  }
  return dates;
}

function filterDates(dates: DateItem[], filterText: string): DateItem[] {
  if (!filterText.trim()) return dates;
  const filter = filterText.toLowerCase().trim();
  return dates.filter(
    (d) => d.dayName.toLowerCase().startsWith(filter) || String(d.dayNum).startsWith(filter)
  );
}

export default component<Component>(({ action }) => ({
  state: (): State => ({
    filterText: "",
    selectedDate: null
  }),

  actions: {
    SetFilter: (_, { state, event }): { state: State } => ({
      state: {
        ...state,
        filterText: ((event?.target as { value?: string })?.value as string) ?? ""
      }
    }),
    SelectDate: ({ id }, { state }): { state: State } => ({
      state: id === state.selectedDate ? state : { ...state, selectedDate: id }
    })
  },

  view(id, { state }): VNode {
    const allDates = getDatesInMonth();
    const filteredDates = filterDates(allDates, state.filterText);

    return div(`#${id}.dates-picker`, [
      div(".filter-row", [
        input(`#${id}-filter`, {
          props: {
            type: "text",
            value: state.filterText,
            placeholder: 'Filter by day (e.g. "Monday" or "15")'
          },
          on: { input: action("SetFilter") }
        })
      ]),
      div(".dates-info", `Showing ${filteredDates.length} of ${allDates.length} days`),
      ul(
        `#${id}-list.dates-list`,
        filteredDates.map((date) =>
          li(
            {
              key: date.id,
              class: { selected: state.selectedDate === date.id },
              on: { click: action("SelectDate", { id: date.id }) }
            },
            date.label
          )
        )
      )
    ]);
  }
}));
