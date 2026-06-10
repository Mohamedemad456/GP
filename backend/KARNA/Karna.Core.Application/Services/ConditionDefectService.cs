using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.ConditionDefect;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Mapping;
using Karna.Core.Application.Specifications.ConditionDefects;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Services
{
	internal class ConditionDefectService(
		IUnitOfWork _unitOfWork,
		ILocalizationService _localizer,
		IValidator<CreateConditionDefectDto> _createValidator,
		IValidator<UpdateConditionDefectDto> _updateValidator
		) : IConditionDefectService
	{
		public async Task<ApiResponse<ConditionDefectDto>> GetByIdAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<ConditionDefect>();
			var defect = await repo.GetWithSpecAsync(new ConditionDefectWithCategorySpecification(id));

			if (defect is null)
				return new ApiResponse<ConditionDefectDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ConditionDefectNotFound")
				};

			return new ApiResponse<ConditionDefectDto>
			{
				Success = true,
				Data = defect.ToDto()
			};
		}

		public async Task<ApiResponse<Pagination<ConditionDefectDto>>> GetAllAsync(ConditionDefectSpecParams specParams)
		{
			var repo = _unitOfWork.GetRepository<ConditionDefect>();

			var dataSpec = new ConditionDefectListSpecification(specParams, activeOnly: false, applyPaging: true, includeCategory: true);
			var countSpec = new ConditionDefectListSpecification(specParams, activeOnly: false, applyPaging: false, includeCategory: false);

			var defects = await repo.GetAllWithSpecAsync(dataSpec);
			var count = await repo.GetCountAsync(countSpec);

			return new ApiResponse<Pagination<ConditionDefectDto>>
			{
				Success = true,
				Data = new Pagination<ConditionDefectDto>(specParams.PageIndex, specParams.PageSize, count)
				{
					Data = defects.ToDto()
				}
			};
		}

		public async Task<ApiResponse<Pagination<ConditionDefectDto>>> GetAllActiveAsync(PaginationSpecParams specParams)
		{
			var repo = _unitOfWork.GetRepository<ConditionDefect>();

			var defectSpecParams = new ConditionDefectSpecParams
			{
				PageIndex = specParams.PageIndex,
				PageSize = specParams.PageSize,
				Search = specParams.Search,
				Sort = specParams.Sort,
				SortDirection = specParams.SortDirection,
				IsActive = true
			};

			var dataSpec = new ConditionDefectListSpecification(defectSpecParams, activeOnly: true, applyPaging: specParams.IsPagingRequested, includeCategory: true);
			var countSpec = new ConditionDefectListSpecification(defectSpecParams, activeOnly: true, applyPaging: false, includeCategory: false);

			var defects = await repo.GetAllWithSpecAsync(dataSpec);
			var count = await repo.GetCountAsync(countSpec);

			return new ApiResponse<Pagination<ConditionDefectDto>>
			{
				Success = true,
				Data = new Pagination<ConditionDefectDto>(specParams.PageIndex, specParams.PageSize, count)
				{
					Data = defects.ToDto()
				}
			};
		}

		public async Task<ApiResponse<ConditionDefectDto>> CreateAsync(CreateConditionDefectDto dto)
		{
			var validationResult = await _createValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
				return new ApiResponse<ConditionDefectDto>
				{
					Success = false,
					Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage))
				};

			var defectRepo = _unitOfWork.GetRepository<ConditionDefect>();
			var categoryRepo = _unitOfWork.GetRepository<ConditionChecklistCategory>();

			var category = await categoryRepo.GetAsync(dto.CategoryId);
			if (category is null)
				return new ApiResponse<ConditionDefectDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ConditionChecklistCategoryNotFound")
				};

			var existing = await defectRepo.GetAsync(d => (d.ItemName == dto.ItemName || d.ItemNameAr == dto.ItemNameAr) && d.CategoryId == dto.CategoryId);
			if (existing is not null)
				return new ApiResponse<ConditionDefectDto>
				{
					Success = false,
					Message = _localizer.GetValidationMessage("ConditionDefectNameAlreadyExists")
				};

			var defect = dto.ToEntity();

			await defectRepo.AddAsync(defect);
			await _unitOfWork.CompleteAsync();

			var createdDefect = await defectRepo.GetWithSpecAsync(new ConditionDefectWithCategorySpecification(defect.Id));
			if (createdDefect is null)
			{
				defect.Category = category;
				createdDefect = defect;
			}

			return new ApiResponse<ConditionDefectDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ConditionDefectCreated"),
				Data = createdDefect.ToDto()
			};
		}

		public async Task<ApiResponse<ConditionDefectDto>> UpdateAsync(Guid id, UpdateConditionDefectDto dto)
		{
			var validationResult = await _updateValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
				return new ApiResponse<ConditionDefectDto>
				{
					Success = false,
					Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage))
				};

			var defectRepo = _unitOfWork.GetRepository<ConditionDefect>();
			var categoryRepo = _unitOfWork.GetRepository<ConditionChecklistCategory>();

			var defect = await defectRepo.GetWithSpecAsync(new ConditionDefectWithCategorySpecification(id));
			if (defect is null)
				return new ApiResponse<ConditionDefectDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ConditionDefectNotFound")
				};

			var category = await categoryRepo.GetAsync(dto.CategoryId);
			if (category is null)
				return new ApiResponse<ConditionDefectDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ConditionChecklistCategoryNotFound")
				};

			var duplicate = await defectRepo.GetAsync(d =>
				(d.ItemName == dto.ItemName || d.ItemNameAr == dto.ItemNameAr) &&
				d.CategoryId == dto.CategoryId &&
				d.Id != id);

			if (duplicate is not null)
				return new ApiResponse<ConditionDefectDto>
				{
					Success = false,
					Message = _localizer.GetValidationMessage("ConditionDefectNameAlreadyExists")
				};

			dto.ApplyTo(defect);
			defect.Category = category;

			defectRepo.Update(defect);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<ConditionDefectDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ConditionDefectUpdated"),
				Data = defect.ToDto()
			};
		}

		public async Task<ApiResponseDto> DeleteAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<ConditionDefect>();
			var defect = await repo.GetAsync(id);

			if (defect is null)
				return new ApiResponseDto
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ConditionDefectNotFound")
				};

			repo.Delete(defect);
			await _unitOfWork.CompleteAsync();

			return new ApiResponseDto
			{
				Success = true,
				Message = _localizer.GetMessage("ConditionDefectDeleted")
			};
		}

		public async Task<ApiResponseDto> ActivateAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<ConditionDefect>();
			var defect = await repo.GetAsync(id);

			if (defect is null)
				return new ApiResponseDto
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ConditionDefectNotFound")
				};

			if (!defect.IsActive)
			{
				defect.IsActive = true;
				repo.Update(defect);
				await _unitOfWork.CompleteAsync();
			}

			return new ApiResponseDto
			{
				Success = true,
				Message = _localizer.GetMessage("ConditionDefectActivated")
			};
		}

		public async Task<ApiResponseDto> DeactivateAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<ConditionDefect>();
			var defect = await repo.GetAsync(id);

			if (defect is null)
				return new ApiResponseDto
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ConditionDefectNotFound")
				};

			if (defect.IsActive)
			{
				defect.IsActive = false;
				repo.Update(defect);
				await _unitOfWork.CompleteAsync();
			}

			return new ApiResponseDto
			{
				Success = true,
				Message = _localizer.GetMessage("ConditionDefectDeactivated")
			};
		}
	}
}
