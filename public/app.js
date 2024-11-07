'use strict';

const { RecoilRoot, atom, useRecoilState, useSetRecoilState } = Recoil;

// Recoil atoms
const todosState = atom({
    key: 'todosState',
    default: []
});

const referencesState = atom({
    key: 'referencesState',
    default: { users: {}, channels: {} }
});

// TodoList Component
function TodoList() {
    const [todos] = useRecoilState(todosState);
    const [references] = useRecoilState(referencesState);

    const formatReference = (ref, type) => {
        const match = ref?.match(/<[@#]([A-Z0-9]+)>/);
        if (!match) return ref;
        const id = match[1];
        const name = type === 'user' 
            ? references.users[id] 
            : references.channels[id];
        return name || (type === 'user' ? '@unknown' : '#unknown');
    };

    return React.createElement('div', { className: 'todos-container' },
        todos.map(todo => 
            React.createElement('div', { 
                key: todo.timestamp,
                className: `todo-card ${todo.status || ''}`
            }, [
                React.createElement('div', { 
                    key: 'task',
                    className: 'todo-task' 
                }, `📌 ${todo.task}`),
                todo.deadline && React.createElement('div', { 
                    key: 'deadline',
                    className: 'todo-deadline' 
                }, `⏰ Due: ${todo.deadline}`),
                React.createElement('div', { 
                    key: 'meta',
                    className: 'todo-meta' 
                }, [
                    'From: ',
                    React.createElement('span', { 
                        key: 'user',
                        className: 'user-tag' 
                    }, formatReference(todo.user, 'user')),
                    ' in ',
                    React.createElement('span', { 
                        key: 'channel',
                        className: 'channel-tag' 
                    }, formatReference(todo.channel, 'channel'))
                ])
            ])
        )
    );
}

// WebSocket Handler Component
function WebSocketHandler() {
    const setTodos = useSetRecoilState(todosState);
    const setReferences = useSetRecoilState(referencesState);

    React.useEffect(() => {
        const ws = new WebSocket(`ws://${window.location.host}`);

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'todos') {
                setTodos(message.data);
                fetchReferences();
            }
        };

        const fetchReferences = async () => {
            try {
                const response = await fetch('/api/resolve-references');
                const data = await response.json();
                setReferences(data);
            } catch (error) {
                console.error('Error fetching references:', error);
            }
        };

        return () => ws.close();
    }, [setTodos, setReferences]);

    return null;
}

// App Component
function App() {
    return React.createElement(RecoilRoot, null,
        React.createElement('div', { className: 'app' }, [
            React.createElement('h1', { key: 'title' }, '📝 Slackdo Todos'),
            React.createElement(WebSocketHandler, { key: 'ws' }),
            React.createElement(TodoList, { key: 'list' })
        ])
    );
}

// Render the App
ReactDOM.render(
    React.createElement(App),
    document.getElementById('root')
); 