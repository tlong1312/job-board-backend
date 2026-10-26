import { Injectable, ForbiddenException } from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { Repository } from "typeorm";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "commons/error";
import * as bcrypt from "bcrypt";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { password, email, ...restData } = createUserDto;
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException("Email này đã được sử dụng");
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = this.usersRepository.create({
      email: normalizedEmail,
      passwordHash,
      ...restData,
    });
    const savedUser = await this.usersRepository.save(newUser);

    const { passwordHash: _, ...result } = savedUser;
    return result;
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find({ 
      order: { id: "ASC" },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ 
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng có id ${id}`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({ 
      where: { email: email.trim().toLowerCase() },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto, currentUser: any) {
    const currentUserId = +(currentUser.id || currentUser.userId || currentUser.sub);

    if (currentUser.role !== 'admin' && currentUserId !== id) {
      throw new ForbiddenException("Bạn không có quyền chỉnh sửa thông tin của người khác.");
    }

    const user = await this.findOne(id);

    if (updateUserDto.fullName) {
      user.fullName = updateUserDto.fullName;
    }
    if (updateUserDto.phone !== undefined) {
      user.phone = updateUserDto.phone;
    }

    const updatedUser = await this.usersRepository.save(user);
    const { passwordHash: _, ...result } = updatedUser;
    return result;
  }

  async remove(id: number, currentUser: any) {
    const currentUserId = +(currentUser.id || currentUser.userId || currentUser.sub);

    if (currentUser.role !== 'admin' && currentUserId !== id) {
      throw new ForbiddenException("Bạn không có quyền khóa tài khoản của người khác.");
    }

    const user = await this.findOne(id);

    if (user.isActive === false) {
      throw new BadRequestException("Tài khoản đã bị vô hiệu hoá trước đó");
    }

    user.isActive = false;
    const deletedUser = await this.usersRepository.save(user);
    const { passwordHash: _, ...result } = deletedUser;
    return result;
  }

  async hardRemove(id: number) {
    await this.findOne(id);
    await this.usersRepository.delete(id);
    return {
      statusCode: 200,
      message: `Đã xóa vĩnh viễn người dùng có ID là ${id}`,
    };
  }
}