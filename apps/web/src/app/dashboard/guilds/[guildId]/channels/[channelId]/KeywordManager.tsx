'use client';

import type { ApiErrorResponse, KeywordDto } from '@tsumugi/contracts';
import { parseApiErrorResponse, parseDashboardKeywordListResponse } from '@tsumugi/contracts';
import { useState } from 'react';

import { DashboardProxyPolicyError, parseKeywordFormInput } from '../../../../../../application/http/dashboardProxyPolicy.js';
import { EmptyState } from '../../../../../_components/EmptyState.js';

export interface KeywordManagerProps {
    guildId: string;
    channelId: string;
    csrfToken: string;
    initialKeywords: KeywordDto[];
}

type MessageKind = 'idle' | 'success' | 'error';

async function responseError(response: Response): Promise<string> {
    const fallback = response.status === 401 ? 'セッションの有効期限が切れました。' : '操作を完了できませんでした。';
    try {
        const body: unknown = await response.json();
        const parsed: ApiErrorResponse = parseApiErrorResponse(body);
        return parsed.error.message || fallback;
    } catch {
        return fallback;
    }
}

function keywordManager({ guildId, channelId, csrfToken, initialKeywords }: KeywordManagerProps): React.JSX.Element {
    const [keywords, setKeywords] = useState<KeywordDto[]>(initialKeywords);
    const [trigger, setTrigger] = useState('');
    const [responsesText, setResponsesText] = useState('');
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState('');
    const [messageKind, setMessageKind] = useState<MessageKind>('idle');
    const endpoint = `/api/dashboard/guilds/${guildId}/channels/${channelId}/keywords`;

    async function refreshKeywords(): Promise<void> {
        const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error(await responseError(response));
        const parsed = parseDashboardKeywordListResponse((await response.json()) as unknown);
        setKeywords(parsed.keywords);
    }

    async function saveKeyword(event: React.SyntheticEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setMessage('');
        setMessageKind('idle');
        let command;
        try {
            command = parseKeywordFormInput(trigger, responsesText);
        } catch (error) {
            setMessage(error instanceof DashboardProxyPolicyError ? error.message : '入力を確認してください。');
            setMessageKind('error');
            return;
        }

        setPending(true);
        try {
            const headers = new Headers();
            headers.set('content-type', 'application/json');
            headers.set('x-csrf-token', csrfToken);
            const response = await fetch(endpoint, {
                method: 'PUT',
                credentials: 'same-origin',
                headers,
                body: JSON.stringify(command)
            });
            if (!response.ok) throw new Error(await responseError(response));
            await refreshKeywords();
            setTrigger('');
            setResponsesText('');
            setMessage('キーワードを保存しました。');
            setMessageKind('success');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'キーワードを保存できませんでした。');
            setMessageKind('error');
        } finally {
            setPending(false);
        }
    }

    async function deleteKeyword(keywordTrigger: string): Promise<void> {
        setPending(true);
        setMessage('');
        setMessageKind('idle');
        try {
            const headers = new Headers();
            headers.set('content-type', 'application/json');
            headers.set('x-csrf-token', csrfToken);
            const response = await fetch(endpoint, {
                method: 'DELETE',
                credentials: 'same-origin',
                headers,
                body: JSON.stringify({ trigger: keywordTrigger })
            });
            if (!response.ok) throw new Error(await responseError(response));
            await refreshKeywords();
            setMessage('キーワードを削除しました。');
            setMessageKind('success');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'キーワードを削除できませんでした。');
            setMessageKind('error');
        } finally {
            setPending(false);
        }
    }

    return (
        <>
            <section className="panel" aria-labelledby="keyword-form-title">
                <div className="panel-heading">
                    <div>
                        <h2 id="keyword-form-title">キーワードを追加・更新</h2>
                        <p>同じキーワードを保存すると応答内容を更新します。</p>
                    </div>
                </div>
                <form
                    onSubmit={(event): void => {
                        void saveKeyword(event);
                    }}
                >
                    <div className="field">
                        <label htmlFor="keyword-trigger">キーワード</label>
                        <input
                            id="keyword-trigger"
                            name="trigger"
                            maxLength={100}
                            required
                            value={trigger}
                            onChange={(event): void => {
                                setTrigger(event.target.value);
                            }}
                            autoComplete="off"
                        />
                        <span className="field-hint">1〜100文字。大文字・小文字や空白も保存内容に含まれます。</span>
                    </div>
                    <div className="field">
                        <label htmlFor="keyword-responses">応答</label>
                        <textarea
                            id="keyword-responses"
                            name="responses"
                            maxLength={1000}
                            required
                            value={responsesText}
                            onChange={(event): void => {
                                setResponsesText(event.target.value);
                            }}
                            aria-describedby="keyword-responses-hint"
                        />
                        <span className="field-hint" id="keyword-responses-hint">
                            1行につき1件、合計1000文字まで。メンションとtokenらしい文字列は保存できません。
                        </span>
                    </div>
                    <div className="form-actions">
                        <p className="form-message" data-kind={messageKind} role="status" aria-live="polite">
                            {message}
                        </p>
                        <button className="button" type="submit" disabled={pending}>
                            {pending ? '保存中…' : '保存'}
                        </button>
                    </div>
                </form>
            </section>

            <section className="panel" aria-labelledby="keyword-list-title">
                <div className="panel-heading">
                    <div>
                        <h2 id="keyword-list-title">登録済みキーワード</h2>
                        <p>{keywords.length}件</p>
                    </div>
                </div>
                {keywords.length === 0 ? (
                    <EmptyState title="キーワードはまだありません" description="上のフォームから最初の応答を追加できます。" />
                ) : (
                    <ul className="keyword-list">
                        {keywords.map(
                            (keyword): React.JSX.Element => (
                                <li className="keyword-item" key={keyword.trigger}>
                                    <div>
                                        <p className="keyword-trigger">{keyword.trigger}</p>
                                        <ul className="keyword-responses">
                                            {keyword.responses.map(
                                                (response, index): React.JSX.Element => (
                                                    <li key={`${keyword.trigger}-${String(index)}`}>{response}</li>
                                                )
                                            )}
                                        </ul>
                                    </div>
                                    <button
                                        className="button-danger"
                                        type="button"
                                        disabled={pending}
                                        onClick={(): void => {
                                            void deleteKeyword(keyword.trigger);
                                        }}
                                        aria-label={`${keyword.trigger}を削除`}
                                    >
                                        削除
                                    </button>
                                </li>
                            )
                        )}
                    </ul>
                )}
            </section>
        </>
    );
}

export { keywordManager as KeywordManager };
