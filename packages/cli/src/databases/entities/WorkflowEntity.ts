import {
	Length,
} from 'class-validator';

import {
	IConnections,
	IDataObject,
	INode,
	IWorkflowSettings,
} from 'n8n-workflow';

import {
	Column,
	ColumnOptions,
	Entity,
	Index,
	JoinTable,
	ManyToMany,
	PrimaryGeneratedColumn,
} from 'typeorm';

import {
	IWorkflowDb,
} from '../../';

import {
	resolveDataType
} from '../utils';

import {
	TagEntity,
} from './TagEntity';

@Entity()
export class WorkflowEntity implements IWorkflowDb {

	@PrimaryGeneratedColumn()
	id: number;

	@Index({ unique: true })
	@Length(1, 128, { message: 'Workflow name must be 1 to 128 characters long.' })
	@Column({ length: 128 })
	name: string;

	@Column()
	active: boolean;

	@Column(resolveDataType('json'))
	nodes: INode[];

	@Column(resolveDataType('json'))
	connections: IConnections;

	@Column(resolveDataType('datetime'))
	createdAt: Date;

	@Column(resolveDataType('datetime'))
	updatedAt: Date;

	@Column({
		type: resolveDataType('json') as ColumnOptions['type'],
		nullable: true,
	})
	settings?: IWorkflowSettings;

	@Column({
		type: resolveDataType('json') as ColumnOptions['type'],
		nullable: true,
	})
	staticData?: IDataObject;

	@ManyToMany(() => TagEntity, tag => tag.workflows)
	@JoinTable({
		name: "workflows_tags", // table name for the junction table of this relation
		joinColumn: {
				name: "workflowId",
				referencedColumnName: "id",
		},
		inverseJoinColumn: {
				name: "tagId",
				referencedColumnName: "id",
		},
	})
	tags: TagEntity[];
}
