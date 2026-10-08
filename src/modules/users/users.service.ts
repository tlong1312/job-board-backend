import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "./entities/user.entity";
import { Repository } from "typeorm";
import { NotFoundException } from "commons/error";
import * as bcrypt from "bcrypt";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const { password, email, ...restData } = createUserDto;

    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException("Email này đã được sử dụng");
    }

    //Hash mật khẩu
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = this.usersRepository.create({
      email,
      passwordHash,
      ...restData,
    });
    const savedUser = await this.usersRepository.save(newUser);

    const { passwordHash: _, ...result } = savedUser;
    return result;
  }

  findAll(): Promise<User[]> {
    return this.usersRepository.find({ order: { id: "ASC" } });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng có id ${id}`);
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
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

  async remove(id: number) {
    const user = await this.findOne(id); 

    // Chặn vô hiệu hoá 2 lần
    if (user.isActive === false) {
      throw new BadRequestException("Tài khoản đã bị vô hiệu hoá trước đó");
    }

    user.isActive = false;
    const deletedUser = await this.usersRepository.save(user);
    const { passwordHash: _, ...result } = deletedUser;
    return result;
  }
}