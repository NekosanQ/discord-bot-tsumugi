import { Interaction, MappedComponentTypes, MappedInteractionTypes, ModalBuilder, ModalSubmitInteraction } from 'discord.js';

import { InteractionBase } from './interaction_base.js';

/**
 * すべてのActionInteractionが共通して持つ、ジェネリックに依存しないインターフェース
 */
export interface IActionInteraction {
    /**
     * アクションを識別するためのID
     */
    readonly id: string;

    /**
     * すべてのインタラクションを受け取るエントリーポイント
     * @param interaction
     */
    onInteractionCreate(interaction: Interaction): Promise<void>;
}
/**
 * アクション
 */
export abstract class ActionInteraction<MenuInteraction extends Interaction & { customId: string }>
    extends InteractionBase
    implements IActionInteraction
{
    /**
     * アクションを識別するためのID
     */
    public get id(): string {
        return this._id;
    }

    /**
     * コンストラクタ
     * @param _id アクションを識別するためのID
     */
    protected constructor(private _id: string) {
        super();
    }

    /**
     * カスタムIDを生成
     * @param data カスタムIDに含めるデータ
     * @returns カスタムID
     */
    protected createCustomId(data?: Record<string, string>): string {
        const params = new URLSearchParams({
            _: this._id,
            ...data
        });
        return params.toString();
    }

    /**
     * カスタムIDが自分のものか確認
     * @param params カスタムIDのパラメータ
     * @returns 自分のものかどうか
     */
    protected isMyCustomId(params: URLSearchParams): boolean {
        if (params.get('_') !== this._id) return false;
        return true;
    }

    /**
     * インタラクションの型が一致するか確認
     * @param interaction インタラクション
     * @returns 一致するかどうか
     */
    protected abstract isType(interaction: Interaction): interaction is MenuInteraction;

    /** @inheritdoc */
    public override async onInteractionCreate(interaction: Interaction): Promise<void> {
        // 型が一致しない場合は無視
        if (!this.isType(interaction)) return;

        // カスタムIDをパースし、自分のアクションか確認
        const params = new URLSearchParams(interaction.customId);
        if (!this.isMyCustomId(params)) return;

        await this.onCommand(interaction, params);
    }

    /**
     * コマンドが実行されたときに呼ばれる
     * @param interaction インタラクション
     * @param params カスタムIDのパラメータ
     */
    protected abstract onCommand(interaction: MenuInteraction, params: URLSearchParams): Promise<void>;
}

/**
 * メッセージコンポーネントのアクション
 */
export abstract class MessageComponentActionInteraction<MenuComponentType extends keyof MappedInteractionTypes> extends ActionInteraction<
    MappedInteractionTypes[MenuComponentType]
> {
    /**
     * コンストラクタ
     * @param id アクションを識別するためのID
     * @param _type コンポーネントの種類
     */
    public constructor(
        id: string,
        private _type: MenuComponentType
    ) {
        super(id);
    }

    /**
     * ビルダーの作成を行う
     * @returns 作成したビルダー
     */
    public abstract create(...args: unknown[]): Promise<MappedComponentTypes[MenuComponentType]>;

    /** @inheritdoc */
    public override createCustomId(data?: Record<string, string>): string {
        return super.createCustomId({
            _t: String(this._type),
            ...data
        });
    }

    /** @inheritdoc */
    public override isMyCustomId(params: URLSearchParams): boolean {
        if (!super.isMyCustomId(params)) return false;
        if (params.get('_t') !== String(this._type)) return false;
        return true;
    }

    /** @inheritdoc */
    public override isType(interaction: Interaction): interaction is MappedInteractionTypes[MenuComponentType] {
        return interaction.isMessageComponent() && interaction.componentType === this._type;
    }
}

/**
 * モーダルダイアログのアクション
 */
export abstract class ModalActionInteraction extends ActionInteraction<ModalSubmitInteraction> {
    /**
     * コンストラクタ
     * @param id アクションを識別するためのID
     */
    public constructor(id: string) {
        super(id);
    }

    /**
     * ビルダーの作成を行う
     * @returns 作成したビルダー
     */
    public abstract create(...args: unknown[]): ModalBuilder;

    /** @inheritdoc */
    public override createCustomId(data?: Record<string, string>): string {
        return super.createCustomId({
            _t: 'm',
            ...data
        });
    }

    /** @inheritdoc */
    public override isMyCustomId(params: URLSearchParams): boolean {
        if (!super.isMyCustomId(params)) return false;
        if (params.get('_t') !== 'm') return false;
        return true;
    }

    /** @inheritdoc */
    public override isType(interaction: Interaction): interaction is ModalSubmitInteraction {
        return interaction.isModalSubmit();
    }
}
