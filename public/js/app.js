'use strict';

const { RecoilRoot, atom, useRecoilState, useSetRecoilState } = Recoil;

// Recoil atoms
const todosState = atom({
    key: 'todosState',
    default: []
});

// TodoList Component
function TodoList() {
    const [todos, setTodos] = useRecoilState(todosState);

    const handleToggle = (timestamp) => {
        const ws = new WebSocket(`ws://${window.location.host}`);
        ws.onopen = () => {
            ws.send(JSON.stringify({
                type: 'toggleStatus',
                timestamp
            }));
        };
    };

    return React.createElement('div', { className: 'todos-container' },
        todos.map(todo => 
            React.createElement('div', { 
                key: todo.timestamp,
                className: `todo-card ${todo.status || ''}`,
                onClick: () => handleToggle(todo.timestamp)
            }, [
                React.createElement('div', { 
                    key: 'task',
                    className: 'todo-task' 
                }, [
                    React.createElement('button', {
                        key: 'checkbox',
                        className: `todo-checkbox ${todo.status === 'completed' ? 'checked' : ''}`,
                        onClick: (e) => {
                            e.stopPropagation();
                            handleToggle(todo.timestamp);
                        }
                    }, todo.status === 'completed' ? '✓' : ''),
                    React.createElement('span', {
                        key: 'text',
                        className: `todo-text ${todo.status === 'completed' ? 'completed' : ''}`
                    }, todo.task)
                ]),
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
                    }, `@${todo.user.name}`),
                    ' in ',
                    React.createElement('span', {
                        key: 'channel',
                        className: 'channel-tag'
                    }, `#${todo.channel.name}`)
                ])
            ])
        )
    );
}

// WebSocket Handler Component
function WebSocketHandler() {
    const setTodos = useSetRecoilState(todosState);
    const ws = React.useRef(null);

    React.useEffect(() => {
        ws.current = new WebSocket(`ws://${window.location.host}`);

        ws.current.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'todos') {
                setTodos(message.data);
            }
        };

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [setTodos]);

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
