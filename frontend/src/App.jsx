import React, { useState, useEffect, useCallback } from 'react';
import { RecoilRoot, atom, useRecoilState, useSetRecoilState } from 'recoil';
import './App.css';

// Recoil atoms for state management
const todosState = atom({
  key: 'todosState',
  default: []
});

const referencesState = atom({
  key: 'referencesState',
  default: { users: {}, channels: {} }
});

function TodoList() {
  const [todos] = useRecoilState(todosState);
  const [references] = useRecoilState(referencesState);

  const formatReference = useCallback((ref, type) => {
    const match = ref.match(/<[@#]([A-Z0-9]+)>/);
    if (!match) return ref;
    const id = match[1];
    const name = type === 'user' 
      ? references.users[id] 
      : references.channels[id];
    return name || (type === 'user' ? '@unknown' : '#unknown');
  }, [references]);

  return (
    <div className="app">
      <h1>📝 Slackdo Todos</h1>
      <div className="todos-container">
        {todos.map((todo, index) => (
          <div key={index} className={`todo-card ${todo.status || ''}`}>
            <div className="todo-task">📌 {todo.task}</div>
            {todo.deadline && (
              <div className="todo-deadline">⏰ Due: {todo.deadline}</div>
            )}
            <div className="todo-meta">
              From: <span className="user-tag">
                {formatReference(todo.user, 'user')}
              </span> in <span className="channel-tag">
                {formatReference(todo.channel, 'channel')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TodoList; 